#!/usr/bin/env python3
"""
File System Crawler and Data Pipeline Monitor

Provides automated file system crawling, change detection, and data pipeline
monitoring for continuous ingestion of oil & gas data.
"""

import os
import logging
import json
import time
import hashlib
import threading
from pathlib import Path
from typing import List, Dict, Optional, Callable, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import re

from .credential_manager import CredentialManager


@dataclass
class FileEvent:
    """File system event representation"""
    event_type: str  # created, modified, deleted
    file_path: str
    file_size: int
    file_hash: Optional[str]
    timestamp: str
    metadata: Dict


class FileSystemCrawler:
    """Automated file system crawler with change detection"""
    
    def __init__(self, watch_directories: List[str], 
                 file_patterns: List[str] = None,
                 output_directory: str = None):
        self.watch_directories = [Path(d) for d in watch_directories]
        self.file_patterns = file_patterns or [
            r'.*\.las$', r'.*\.LAS$',      # Well logs
            r'.*\.accdb$', r'.*\.mdb$',    # Access databases
            r'.*\.shp$', r'.*\.SHP$',      # Shapefiles
            r'.*\.csv$', r'.*\.xlsx?$'     # Data files
        ]
        self.output_directory = Path(output_directory) if output_directory else Path('./crawl_outputs')
        self.output_directory.mkdir(parents=True, exist_ok=True)
        
        self.logger = logging.getLogger(__name__)
        self.file_registry = {}  # file_path -> {hash, size, mtime}
        self.running = False
        self.scan_interval = 300  # 5 minutes default
        
        # Event callbacks
        self.event_callbacks = []
    
    def add_event_callback(self, callback: Callable[[FileEvent], None]):
        """Add callback for file events"""
        self.event_callbacks.append(callback)
    
    def start_monitoring(self, scan_interval: int = None):
        """Start continuous file monitoring"""
        if scan_interval:
            self.scan_interval = scan_interval
            
        self.running = True
        self.logger.info(f"Starting file crawler monitoring (interval: {self.scan_interval}s)")
        
        # Initial scan
        self._full_scan()
        
        # Start monitoring thread
        monitor_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        monitor_thread.start()
        
        return monitor_thread
    
    def stop_monitoring(self):
        """Stop file monitoring"""
        self.running = False
        self.logger.info("File crawler monitoring stopped")
    
    def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                self._incremental_scan()
                time.sleep(self.scan_interval)
            except Exception as e:
                self.logger.error(f"Monitoring error: {e}")
                time.sleep(60)  # Wait before retrying
    
    def _full_scan(self):
        """Perform full file system scan"""
        self.logger.info("Performing full file system scan")
        found_files = {}
        
        for watch_dir in self.watch_directories:
            if not watch_dir.exists():
                self.logger.warning(f"Watch directory not found: {watch_dir}")
                continue
            
            try:
                for file_path in self._scan_directory(watch_dir):
                    if self._matches_patterns(file_path.name):
                        file_info = self._get_file_info(file_path)
                        if file_info:
                            found_files[str(file_path)] = file_info
                            
                            # Check if this is a new file
                            if str(file_path) not in self.file_registry:
                                self._emit_event(FileEvent(
                                    event_type='discovered',
                                    file_path=str(file_path),
                                    file_size=file_info['size'],
                                    file_hash=file_info['hash'],
                                    timestamp=datetime.now().isoformat(),
                                    metadata={'scan_type': 'full', 'directory': str(watch_dir)}
                                ))
                                
            except Exception as e:
                self.logger.error(f"Error scanning directory {watch_dir}: {e}")
        
        self.file_registry = found_files
        self.logger.info(f"Full scan complete: {len(found_files)} files tracked")
    
    def _incremental_scan(self):
        """Perform incremental scan for changes"""
        current_files = {}
        
        for watch_dir in self.watch_directories:
            if not watch_dir.exists():
                continue
                
            try:
                for file_path in self._scan_directory(watch_dir):
                    if self._matches_patterns(file_path.name):
                        file_info = self._get_file_info(file_path)
                        if file_info:
                            current_files[str(file_path)] = file_info
            except Exception as e:
                self.logger.error(f"Error in incremental scan: {e}")
        
        # Detect changes
        self._detect_changes(current_files)
        self.file_registry = current_files
    
    def _scan_directory(self, directory: Path):
        """Recursively scan directory for files"""
        try:
            for item in directory.rglob('*'):
                if item.is_file():
                    yield item
        except PermissionError:
            self.logger.warning(f"Permission denied: {directory}")
        except Exception as e:
            self.logger.error(f"Error scanning {directory}: {e}")
    
    def _matches_patterns(self, filename: str) -> bool:
        """Check if filename matches any pattern"""
        for pattern in self.file_patterns:
            if re.match(pattern, filename, re.IGNORECASE):
                return True
        return False
    
    def _get_file_info(self, file_path: Path) -> Optional[Dict]:
        """Get file information and hash"""
        try:
            stat = file_path.stat()
            
            # Calculate hash for files under 100MB
            file_hash = None
            if stat.st_size < 100 * 1024 * 1024:  # 100MB limit
                file_hash = self._calculate_file_hash(file_path)
            
            return {
                'size': stat.st_size,
                'mtime': stat.st_mtime,
                'hash': file_hash,
                'type': self._get_file_type(file_path.name)
            }
        except Exception as e:
            self.logger.error(f"Error getting file info for {file_path}: {e}")
            return None
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of file"""
        hash_sha256 = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_sha256.update(chunk)
            return hash_sha256.hexdigest()
        except Exception as e:
            self.logger.error(f"Error calculating hash for {file_path}: {e}")
            return None
    
    def _detect_changes(self, current_files: Dict):
        """Detect file changes between scans"""
        old_files = set(self.file_registry.keys())
        new_files = set(current_files.keys())
        
        # New files
        for file_path in new_files - old_files:
            file_info = current_files[file_path]
            self._emit_event(FileEvent(
                event_type='created',
                file_path=file_path,
                file_size=file_info['size'],
                file_hash=file_info['hash'],
                timestamp=datetime.now().isoformat(),
                metadata=file_info
            ))
        
        # Deleted files
        for file_path in old_files - new_files:
            self._emit_event(FileEvent(
                event_type='deleted',
                file_path=file_path,
                file_size=0,
                file_hash=None,
                timestamp=datetime.now().isoformat(),
                metadata={}
            ))
        
        # Modified files
        for file_path in old_files & new_files:
            old_info = self.file_registry[file_path]
            new_info = current_files[file_path]
            
            # Check for changes
            if (old_info.get('hash') != new_info.get('hash') or
                old_info.get('size') != new_info.get('size') or
                abs(old_info.get('mtime', 0) - new_info.get('mtime', 0)) > 1):
                
                self._emit_event(FileEvent(
                    event_type='modified',
                    file_path=file_path,
                    file_size=new_info['size'],
                    file_hash=new_info['hash'],
                    timestamp=datetime.now().isoformat(),
                    metadata=new_info
                ))
    
    def _emit_event(self, event: FileEvent):
        """Emit file event to callbacks"""
        self.logger.info(f"File event: {event.event_type} - {event.file_path}")
        
        # Save event to log
        self._log_event(event)
        
        # Call registered callbacks
        for callback in self.event_callbacks:
            try:
                callback(event)
            except Exception as e:
                self.logger.error(f"Event callback error: {e}")
    
    def _log_event(self, event: FileEvent):
        """Log event to file"""
        log_file = self.output_directory / "file_events.jsonl"
        
        try:
            with open(log_file, 'a') as f:
                f.write(json.dumps(asdict(event)) + '\n')
        except Exception as e:
            self.logger.error(f"Error logging event: {e}")
    
    def _get_file_type(self, filename: str) -> str:
        """Determine file type from extension"""
        ext = Path(filename).suffix.lower()
        type_map = {
            '.las': 'well_log',
            '.accdb': 'access_db',
            '.mdb': 'access_db',
            '.shp': 'shapefile',
            '.csv': 'data_table',
            '.xlsx': 'spreadsheet',
            '.xls': 'spreadsheet'
        }
        return type_map.get(ext, 'unknown')
    
    def get_file_summary(self) -> Dict:
        """Get summary of tracked files"""
        total_files = len(self.file_registry)
        total_size = sum(info['size'] for info in self.file_registry.values())
        
        # Group by file type
        type_counts = {}
        for info in self.file_registry.values():
            file_type = info['type']
            type_counts[file_type] = type_counts.get(file_type, 0) + 1
        
        return {
            'total_files': total_files,
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'file_types': type_counts,
            'watch_directories': [str(d) for d in self.watch_directories],
            'last_scan': datetime.now().isoformat()
        }


class DataPipelineMonitor:
    """Monitor data pipeline execution and health"""
    
    def __init__(self, pipeline_output_dir: str, 
                 monitor_output_dir: str = None):
        self.pipeline_output_dir = Path(pipeline_output_dir)
        self.monitor_output_dir = Path(monitor_output_dir) if monitor_output_dir else Path('./pipeline_monitor')
        self.monitor_output_dir.mkdir(parents=True, exist_ok=True)
        
        self.logger = logging.getLogger(__name__)
        self.pipeline_runs = {}  # run_id -> run_info
        self.running = False
    
    def start_monitoring(self, check_interval: int = 60):
        """Start pipeline monitoring"""
        self.running = True
        self.logger.info("Starting pipeline monitoring")
        
        monitor_thread = threading.Thread(
            target=self._monitoring_loop,
            args=(check_interval,),
            daemon=True
        )
        monitor_thread.start()
        return monitor_thread
    
    def stop_monitoring(self):
        """Stop pipeline monitoring"""
        self.running = False
        self.logger.info("Pipeline monitoring stopped")
    
    def _monitoring_loop(self, check_interval: int):
        """Main monitoring loop"""
        while self.running:
            try:
                self._check_pipeline_runs()
                self._generate_health_report()
                time.sleep(check_interval)
            except Exception as e:
                self.logger.error(f"Pipeline monitoring error: {e}")
                time.sleep(60)
    
    def _check_pipeline_runs(self):
        """Check for new and updated pipeline runs"""
        if not self.pipeline_output_dir.exists():
            return
        
        # Scan for run directories
        for run_dir in self.pipeline_output_dir.iterdir():
            if not run_dir.is_dir():
                continue
            
            run_id = run_dir.name
            
            # Check if this is a new run or updated run
            if run_id not in self.pipeline_runs:
                # New run
                run_info = self._analyze_run(run_dir)
                self.pipeline_runs[run_id] = run_info
                self.logger.info(f"New pipeline run detected: {run_id}")
            else:
                # Check for updates
                current_info = self._analyze_run(run_dir)
                old_info = self.pipeline_runs[run_id]
                
                if current_info['status'] != old_info['status']:
                    self.pipeline_runs[run_id] = current_info
                    self.logger.info(f"Pipeline run status changed: {run_id} -> {current_info['status']}")
    
    def _analyze_run(self, run_dir: Path) -> Dict:
        """Analyze pipeline run directory"""
        run_info = {
            'run_id': run_dir.name,
            'start_time': None,
            'end_time': None,
            'status': 'unknown',
            'outputs': [],
            'errors': [],
            'agents_completed': 0,
            'total_size_mb': 0
        }
        
        try:
            # Check for common output files
            expected_outputs = [
                'geology_summary.md',
                'zones.geojson',
                'drill_forecast.json',
                'ownership.json',
                'valuation.json',
                'risk_assessment.json',
                'investment_decision.json',
                'SHALE_YEAH_REPORT.md'
            ]
            
            found_outputs = []
            total_size = 0
            
            for output_file in expected_outputs:
                file_path = run_dir / output_file
                if file_path.exists():
                    stat = file_path.stat()
                    found_outputs.append({
                        'file': output_file,
                        'size_bytes': stat.st_size,
                        'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
                    })
                    total_size += stat.st_size
            
            run_info['outputs'] = found_outputs
            run_info['agents_completed'] = len(found_outputs)
            run_info['total_size_mb'] = round(total_size / (1024 * 1024), 2)
            
            # Determine status
            if len(found_outputs) >= 7:  # Most outputs present
                run_info['status'] = 'completed'
            elif len(found_outputs) > 0:
                run_info['status'] = 'in_progress'
            else:
                run_info['status'] = 'failed'
            
            # Check for errors
            error_files = list(run_dir.glob('*.error')) + list(run_dir.glob('errors.log'))
            for error_file in error_files:
                try:
                    with open(error_file, 'r') as f:
                        run_info['errors'].append({
                            'file': error_file.name,
                            'content': f.read()[:1000]  # First 1000 chars
                        })
                except Exception:
                    pass
            
            # Get timing info if available
            if found_outputs:
                times = [datetime.fromisoformat(out['modified']) for out in found_outputs]
                run_info['start_time'] = min(times).isoformat()
                run_info['end_time'] = max(times).isoformat()
        
        except Exception as e:
            self.logger.error(f"Error analyzing run {run_dir}: {e}")
            run_info['status'] = 'error'
            run_info['errors'].append({'error': str(e)})
        
        return run_info
    
    def _generate_health_report(self):
        """Generate pipeline health report"""
        try:
            # Calculate statistics
            total_runs = len(self.pipeline_runs)
            completed_runs = sum(1 for run in self.pipeline_runs.values() if run['status'] == 'completed')
            failed_runs = sum(1 for run in self.pipeline_runs.values() if run['status'] == 'failed')
            in_progress_runs = sum(1 for run in self.pipeline_runs.values() if run['status'] == 'in_progress')
            
            # Recent runs (last 24 hours)
            recent_cutoff = datetime.now() - timedelta(hours=24)
            recent_runs = []
            
            for run in self.pipeline_runs.values():
                if run.get('start_time'):
                    try:
                        start_time = datetime.fromisoformat(run['start_time'])
                        if start_time > recent_cutoff:
                            recent_runs.append(run)
                    except:
                        pass
            
            # Generate report
            report = {
                'timestamp': datetime.now().isoformat(),
                'pipeline_health': {
                    'total_runs': total_runs,
                    'completed_runs': completed_runs,
                    'failed_runs': failed_runs,
                    'in_progress_runs': in_progress_runs,
                    'success_rate': round(completed_runs / max(total_runs, 1), 3)
                },
                'recent_activity': {
                    'runs_last_24h': len(recent_runs),
                    'recent_runs': recent_runs[:10]  # Last 10 recent runs
                },
                'system_status': self._get_system_status()
            }
            
            # Save report
            report_file = self.monitor_output_dir / "pipeline_health.json"
            with open(report_file, 'w') as f:
                json.dump(report, f, indent=2)
        
        except Exception as e:
            self.logger.error(f"Error generating health report: {e}")
    
    def _get_system_status(self) -> Dict:
        """Get system status information"""
        try:
            import psutil
            
            return {
                'disk_usage': {
                    'total_gb': round(psutil.disk_usage('/').total / (1024**3), 2),
                    'used_gb': round(psutil.disk_usage('/').used / (1024**3), 2),
                    'free_gb': round(psutil.disk_usage('/').free / (1024**3), 2),
                    'percent_used': psutil.disk_usage('/').percent
                },
                'memory_usage': {
                    'total_gb': round(psutil.virtual_memory().total / (1024**3), 2),
                    'used_gb': round(psutil.virtual_memory().used / (1024**3), 2),
                    'percent_used': psutil.virtual_memory().percent
                },
                'cpu_usage': psutil.cpu_percent(interval=1)
            }
        except ImportError:
            return {'error': 'psutil not available for system monitoring'}
        except Exception as e:
            return {'error': f'System status error: {e}'}
    
    def get_pipeline_summary(self) -> Dict:
        """Get summary of all pipeline runs"""
        return {
            'total_runs': len(self.pipeline_runs),
            'runs_by_status': {
                status: sum(1 for run in self.pipeline_runs.values() if run['status'] == status)
                for status in ['completed', 'failed', 'in_progress', 'unknown']
            },
            'latest_runs': list(self.pipeline_runs.values())[-5:],  # Last 5 runs
            'monitoring_since': datetime.now().isoformat()
        }


# Utility functions for pipeline integration
def setup_automatic_ingestion(watch_directories: List[str],
                            pipeline_command: str,
                            output_directory: str = None) -> FileSystemCrawler:
    """Set up automatic data ingestion pipeline"""
    
    def trigger_pipeline(event: FileEvent):
        """Trigger pipeline when new files are detected"""
        if event.event_type in ['created', 'discovered']:
            logger = logging.getLogger(__name__)
            logger.info(f"Triggering pipeline for new file: {event.file_path}")
            
            # Generate run ID based on timestamp
            run_id = f"auto_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            # Execute pipeline command
            import subprocess
            try:
                cmd = pipeline_command.format(
                    input_file=event.file_path,
                    run_id=run_id,
                    output_dir=output_directory or './auto_outputs'
                )
                subprocess.Popen(cmd, shell=True)
                logger.info(f"Pipeline started with run_id: {run_id}")
            except Exception as e:
                logger.error(f"Failed to trigger pipeline: {e}")
    
    # Create and configure crawler
    crawler = FileSystemCrawler(watch_directories, output_directory=output_directory)
    crawler.add_event_callback(trigger_pipeline)
    
    return crawler