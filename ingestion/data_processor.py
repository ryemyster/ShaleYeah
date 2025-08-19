#!/usr/bin/env python3
"""
Data Processor - Process and transform ingested oil & gas data

Handles parsing of LAS files, Access databases, shapefiles, and other formats
commonly used in oil & gas operations. Provides standardized output formats.
"""

import os
import logging
import json
import csv
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import re
from datetime import datetime

try:
    import lasio
    LASIO_AVAILABLE = True
except ImportError:
    LASIO_AVAILABLE = False
    logging.warning("lasio not available - LAS file processing disabled")

try:
    import pyodbc
    PYODBC_AVAILABLE = True
except ImportError:
    PYODBC_AVAILABLE = False


class DataProcessor:
    """Base class for data processing"""
    
    def __init__(self, output_directory: str = None):
        self.output_directory = Path(output_directory) if output_directory else Path('./processed_data')
        self.output_directory.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
    
    def process_file(self, file_path: str, file_type: str = None) -> Dict:
        """Process a file based on its type"""
        file_path = Path(file_path)
        
        if not file_path.exists():
            return {'success': False, 'error': f'File not found: {file_path}'}
        
        # Auto-detect file type if not provided
        if not file_type:
            file_type = self._detect_file_type(file_path)
        
        try:
            if file_type == 'well_log':
                return self._process_las_file(file_path)
            elif file_type == 'access_db':
                return self._process_access_db(file_path)
            elif file_type == 'data_table':
                return self._process_data_table(file_path)
            elif file_type == 'shapefile':
                return self._process_shapefile(file_path)
            else:
                return {'success': False, 'error': f'Unsupported file type: {file_type}'}
                
        except Exception as e:
            self.logger.error(f"Error processing {file_path}: {e}")
            return {'success': False, 'error': str(e)}
    
    def _detect_file_type(self, file_path: Path) -> str:
        """Detect file type from extension"""
        ext = file_path.suffix.lower()
        type_map = {
            '.las': 'well_log',
            '.accdb': 'access_db',
            '.mdb': 'access_db',
            '.csv': 'data_table',
            '.xlsx': 'data_table',
            '.xls': 'data_table',
            '.shp': 'shapefile'
        }
        return type_map.get(ext, 'unknown')
    
    def _process_las_file(self, file_path: Path) -> Dict:
        """Process LAS well log file"""
        processor = LASProcessor(str(self.output_directory))
        return processor.process_las_file(str(file_path))
    
    def _process_access_db(self, file_path: Path) -> Dict:
        """Process Access database file"""
        processor = AccessProcessor(str(self.output_directory))
        return processor.process_access_db(str(file_path))
    
    def _process_data_table(self, file_path: Path) -> Dict:
        """Process CSV/Excel data table"""
        try:
            # Read data
            if file_path.suffix.lower() == '.csv':
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)
            
            # Basic processing
            output_file = self.output_directory / f"{file_path.stem}_processed.csv"
            df.to_csv(output_file, index=False)
            
            return {
                'success': True,
                'output_file': str(output_file),
                'rows': len(df),
                'columns': list(df.columns),
                'file_type': 'data_table'
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _process_shapefile(self, file_path: Path) -> Dict:
        """Process shapefile (placeholder)"""
        # This would require geopandas or similar
        return {
            'success': False,
            'error': 'Shapefile processing not implemented - requires geopandas'
        }


class LASProcessor:
    """Specialized processor for LAS well log files"""
    
    def __init__(self, output_directory: str):
        self.output_directory = Path(output_directory)
        self.output_directory.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
    
    def process_las_file(self, file_path: str) -> Dict:
        """Process LAS file and extract well log data"""
        
        if not LASIO_AVAILABLE:
            return {'success': False, 'error': 'lasio library not available'}
        
        try:
            # Read LAS file
            las = lasio.read(file_path)
            file_stem = Path(file_path).stem
            
            # Extract well information
            well_info = self._extract_well_info(las)
            
            # Extract curve data
            curve_data = self._extract_curve_data(las)
            
            # Save processed data
            outputs = {}
            
            # Save well information as JSON
            info_file = self.output_directory / f"{file_stem}_well_info.json"
            with open(info_file, 'w') as f:
                json.dump(well_info, f, indent=2)
            outputs['well_info'] = str(info_file)
            
            # Save curve data as CSV
            if curve_data is not None and not curve_data.empty:
                data_file = self.output_directory / f"{file_stem}_curves.csv"
                curve_data.to_csv(data_file, index=True)
                outputs['curve_data'] = str(data_file)
                
                # Generate summary statistics
                stats = self._generate_curve_statistics(curve_data, well_info)
                stats_file = self.output_directory / f"{file_stem}_statistics.json"
                with open(stats_file, 'w') as f:
                    json.dump(stats, f, indent=2)
                outputs['statistics'] = str(stats_file)
            
            return {
                'success': True,
                'outputs': outputs,
                'well_info': well_info,
                'curves': list(curve_data.columns) if curve_data is not None else [],
                'depth_range': [float(curve_data.index.min()), float(curve_data.index.max())] if curve_data is not None else None
            }
            
        except Exception as e:
            self.logger.error(f"Error processing LAS file {file_path}: {e}")
            return {'success': False, 'error': str(e)}
    
    def _extract_well_info(self, las) -> Dict:
        """Extract well header information"""
        well_info = {
            'well_name': getattr(las.well, 'WELL', {}).get('value', ''),
            'api_number': getattr(las.well, 'API', {}).get('value', ''),
            'operator': getattr(las.well, 'COMP', {}).get('value', ''),
            'field': getattr(las.well, 'FLD', {}).get('value', ''),
            'location': {
                'latitude': getattr(las.well, 'LATI', {}).get('value', None),
                'longitude': getattr(las.well, 'LONG', {}).get('value', None),
                'section': getattr(las.well, 'SECT', {}).get('value', ''),
                'township': getattr(las.well, 'TOWN', {}).get('value', ''),
                'range': getattr(las.well, 'RANG', {}).get('value', ''),
                'state': getattr(las.well, 'STAT', {}).get('value', ''),
                'county': getattr(las.well, 'CNTY', {}).get('value', '')
            },
            'dates': {
                'spud_date': getattr(las.well, 'DATE', {}).get('value', ''),
                'log_date': getattr(las.well, 'DATE', {}).get('value', '')
            },
            'depths': {
                'kelly_bushing': getattr(las.well, 'EKB', {}).get('value', None),
                'derrick_floor': getattr(las.well, 'EDF', {}).get('value', None),
                'ground_level': getattr(las.well, 'EGL', {}).get('value', None),
                'total_depth': getattr(las.well, 'TD', {}).get('value', None)
            },
            'curves_info': {}
        }
        
        # Extract curve information
        for curve in las.curves:
            well_info['curves_info'][curve.mnemonic] = {
                'description': curve.descr,
                'unit': curve.unit,
                'api_code': getattr(curve, 'api_code', None)
            }
        
        return well_info
    
    def _extract_curve_data(self, las) -> pd.DataFrame:
        """Extract curve data as DataFrame"""
        try:
            df = las.df()
            
            # Clean up data
            df = df.replace(las.well['NULL'].value, pd.NA)  # Replace null values
            df = df.dropna(how='all')  # Remove rows with all NaN
            
            return df
        except Exception as e:
            self.logger.error(f"Error extracting curve data: {e}")
            return pd.DataFrame()
    
    def _generate_curve_statistics(self, curve_data: pd.DataFrame, well_info: Dict) -> Dict:
        """Generate statistical summary of curve data"""
        stats = {
            'well_name': well_info.get('well_name', ''),
            'total_depth_range': {
                'min': float(curve_data.index.min()),
                'max': float(curve_data.index.max()),
                'count': len(curve_data)
            },
            'curves': {}
        }
        
        # Statistics for each curve
        for column in curve_data.columns:
            curve_stats = curve_data[column].describe()
            stats['curves'][column] = {
                'count': int(curve_stats['count']),
                'mean': float(curve_stats['mean']) if pd.notna(curve_stats['mean']) else None,
                'std': float(curve_stats['std']) if pd.notna(curve_stats['std']) else None,
                'min': float(curve_stats['min']) if pd.notna(curve_stats['min']) else None,
                'max': float(curve_stats['max']) if pd.notna(curve_stats['max']) else None,
                'median': float(curve_stats['50%']) if pd.notna(curve_stats['50%']) else None,
                'unit': well_info.get('curves_info', {}).get(column, {}).get('unit', '')
            }
        
        return stats


class AccessProcessor:
    """Specialized processor for Microsoft Access databases"""
    
    def __init__(self, output_directory: str):
        self.output_directory = Path(output_directory)
        self.output_directory.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
    
    def process_access_db(self, file_path: str) -> Dict:
        """Process Access database and export tables"""
        
        if not PYODBC_AVAILABLE:
            return self._process_access_with_mdb_tools(file_path)
        
        try:
            # Connection string for Access database
            conn_str = f"DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={file_path};"
            
            with pyodbc.connect(conn_str) as conn:
                # Get list of tables
                tables = self._get_table_names(conn)
                
                outputs = {}
                table_info = {}
                
                # Export each table
                for table_name in tables:
                    try:
                        # Read table data
                        query = f"SELECT * FROM [{table_name}]"
                        df = pd.read_sql(query, conn)
                        
                        # Export to CSV
                        file_stem = Path(file_path).stem
                        output_file = self.output_directory / f"{file_stem}_{table_name}.csv"
                        df.to_csv(output_file, index=False)
                        
                        outputs[table_name] = str(output_file)
                        table_info[table_name] = {
                            'rows': len(df),
                            'columns': list(df.columns),
                            'output_file': str(output_file)
                        }
                        
                        self.logger.info(f"Exported table {table_name}: {len(df)} rows")
                        
                    except Exception as e:
                        self.logger.error(f"Error exporting table {table_name}: {e}")
                        table_info[table_name] = {'error': str(e)}
                
                # Save summary
                summary_file = self.output_directory / f"{Path(file_path).stem}_summary.json"
                summary = {
                    'source_file': file_path,
                    'processed_date': datetime.now().isoformat(),
                    'tables': table_info,
                    'total_tables': len(tables),
                    'successful_exports': len(outputs)
                }
                
                with open(summary_file, 'w') as f:
                    json.dump(summary, f, indent=2)
                
                return {
                    'success': True,
                    'outputs': outputs,
                    'summary': summary,
                    'summary_file': str(summary_file)
                }
                
        except Exception as e:
            self.logger.error(f"Error processing Access database {file_path}: {e}")
            return {'success': False, 'error': str(e)}
    
    def _process_access_with_mdb_tools(self, file_path: str) -> Dict:
        """Process Access database using mdb-tools (Linux/Mac alternative)"""
        try:
            import subprocess
            
            # Get table list
            result = subprocess.run(['mdb-tables', '-1', file_path], 
                                  capture_output=True, text=True)
            
            if result.returncode != 0:
                return {'success': False, 'error': 'mdb-tools not available'}
            
            tables = [t.strip() for t in result.stdout.split('\n') if t.strip()]
            outputs = {}
            table_info = {}
            
            # Export each table
            for table_name in tables:
                try:
                    # Export table to CSV
                    file_stem = Path(file_path).stem
                    output_file = self.output_directory / f"{file_stem}_{table_name}.csv"
                    
                    with open(output_file, 'w') as f:
                        subprocess.run(['mdb-export', file_path, table_name],
                                     stdout=f, check=True)
                    
                    # Count rows
                    with open(output_file, 'r') as f:
                        reader = csv.reader(f)
                        rows = sum(1 for _ in reader) - 1  # Subtract header
                        columns = next(csv.reader(open(output_file, 'r')))
                    
                    outputs[table_name] = str(output_file)
                    table_info[table_name] = {
                        'rows': rows,
                        'columns': columns,
                        'output_file': str(output_file)
                    }
                    
                except Exception as e:
                    self.logger.error(f"Error exporting table {table_name}: {e}")
                    table_info[table_name] = {'error': str(e)}
            
            return {
                'success': True,
                'outputs': outputs,
                'table_info': table_info,
                'method': 'mdb-tools'
            }
            
        except Exception as e:
            return {'success': False, 'error': f'mdb-tools processing failed: {e}'}
    
    def _get_table_names(self, conn) -> List[str]:
        """Get list of table names from Access database"""
        cursor = conn.cursor()
        tables = []
        
        try:
            # Get user tables (exclude system tables)
            for row in cursor.tables(tableType='TABLE'):
                table_name = row.table_name
                if not table_name.startswith('MSys'):  # Skip system tables
                    tables.append(table_name)
        except Exception as e:
            self.logger.error(f"Error getting table names: {e}")
        
        return tables


# Utility functions
def create_data_processor(output_directory: str = None) -> DataProcessor:
    """Create data processor instance"""
    return DataProcessor(output_directory)


def batch_process_files(file_list: List[str], 
                       output_directory: str = None) -> List[Dict]:
    """Process multiple files in batch"""
    processor = DataProcessor(output_directory)
    results = []
    
    for file_path in file_list:
        result = processor.process_file(file_path)
        result['source_file'] = file_path
        results.append(result)
    
    return results


def generate_processing_report(results: List[Dict], output_file: str = None) -> Dict:
    """Generate report from processing results"""
    
    total_files = len(results)
    successful = sum(1 for r in results if r.get('success'))
    failed = total_files - successful
    
    # Group by file type
    by_type = {}
    for result in results:
        file_type = result.get('file_type', 'unknown')
        if file_type not in by_type:
            by_type[file_type] = {'total': 0, 'successful': 0, 'failed': 0}
        
        by_type[file_type]['total'] += 1
        if result.get('success'):
            by_type[file_type]['successful'] += 1
        else:
            by_type[file_type]['failed'] += 1
    
    report = {
        'processing_summary': {
            'total_files': total_files,
            'successful': successful,
            'failed': failed,
            'success_rate': round(successful / max(total_files, 1), 3)
        },
        'by_file_type': by_type,
        'detailed_results': results,
        'generated_at': datetime.now().isoformat()
    }
    
    if output_file:
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)
    
    return report