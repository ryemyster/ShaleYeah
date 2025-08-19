#!/usr/bin/env python3
"""
Real-time Data Streaming for Production Monitoring

Provides real-time data streaming capabilities for production monitoring,
SCADA integration, and live well performance tracking.
"""

import os
import logging
import json
import asyncio
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Callable, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import websocket
import requests
from queue import Queue, Empty

from .credential_manager import CredentialManager


@dataclass
class ProductionDataPoint:
    """Production data point structure"""
    timestamp: str
    well_id: str
    api_number: str
    oil_rate: Optional[float]  # bbl/day
    gas_rate: Optional[float]  # mcf/day
    water_rate: Optional[float]  # bbl/day
    pressure: Optional[float]  # psi
    temperature: Optional[float]  # F
    status: str  # producing, shut-in, offline
    metadata: Dict


class StreamingDataClient:
    """Base class for streaming data clients"""
    
    def __init__(self, name: str, output_directory: str = None):
        self.name = name
        self.output_directory = Path(output_directory) if output_directory else Path('./streaming_data')
        self.output_directory.mkdir(parents=True, exist_ok=True)
        
        self.logger = logging.getLogger(__name__)
        self.data_queue = Queue()
        self.callbacks = []
        self.is_streaming = False
        
        # Data buffer for batch processing
        self.data_buffer = []
        self.buffer_size = 100
        self.last_flush = time.time()
        self.flush_interval = 300  # 5 minutes
    
    def add_callback(self, callback: Callable[[ProductionDataPoint], None]):
        """Add data callback"""
        self.callbacks.append(callback)
    
    def start_streaming(self):
        """Start streaming (to be implemented by subclasses)"""
        self.is_streaming = True
        self.logger.info(f"Starting streaming for {self.name}")
        
        # Start data processing thread
        processing_thread = threading.Thread(target=self._process_data_queue, daemon=True)
        processing_thread.start()
        
        return processing_thread
    
    def stop_streaming(self):
        """Stop streaming"""
        self.is_streaming = False
        self._flush_buffer()  # Flush remaining data
        self.logger.info(f"Streaming stopped for {self.name}")
    
    def _process_data_queue(self):
        """Process incoming data from queue"""
        while self.is_streaming:
            try:
                # Get data from queue (timeout to allow checking is_streaming)
                try:
                    data_point = self.data_queue.get(timeout=1.0)
                except Empty:
                    continue
                
                # Add to buffer
                self.data_buffer.append(data_point)
                
                # Call callbacks
                for callback in self.callbacks:
                    try:
                        callback(data_point)
                    except Exception as e:
                        self.logger.error(f"Callback error: {e}")
                
                # Flush buffer if needed
                if (len(self.data_buffer) >= self.buffer_size or 
                    time.time() - self.last_flush > self.flush_interval):
                    self._flush_buffer()
                
            except Exception as e:
                self.logger.error(f"Data processing error: {e}")
    
    def _flush_buffer(self):
        """Flush data buffer to storage"""
        if not self.data_buffer:
            return
        
        try:
            # Save to JSONL file
            timestamp = datetime.now().strftime("%Y%m%d_%H")
            output_file = self.output_directory / f"{self.name}_data_{timestamp}.jsonl"
            
            with open(output_file, 'a') as f:
                for data_point in self.data_buffer:
                    f.write(json.dumps(asdict(data_point)) + '\n')
            
            self.logger.info(f"Flushed {len(self.data_buffer)} data points to {output_file}")
            
            # Clear buffer
            self.data_buffer.clear()
            self.last_flush = time.time()
            
        except Exception as e:
            self.logger.error(f"Buffer flush error: {e}")


class SCADAStreamingClient(StreamingDataClient):
    """SCADA system streaming client"""
    
    def __init__(self, scada_host: str, scada_port: int = 502,
                 credential_key: str = None, output_directory: str = None):
        super().__init__("SCADA", output_directory)
        self.scada_host = scada_host
        self.scada_port = scada_port
        self.credential_key = credential_key
        
        # Get credentials if provided
        if credential_key:
            cred_manager = CredentialManager()
            self.credentials = cred_manager.get_credentials(credential_key)
        else:
            self.credentials = {}
        
        # Well tag mappings (would be configured per site)
        self.well_mappings = self._load_well_mappings()
    
    def _load_well_mappings(self) -> Dict:
        """Load well-to-tag mappings"""
        # This would typically come from a configuration file
        return {
            "WELL001": {
                "api_number": "42-123-12345",
                "tags": {
                    "oil_rate": "AI_001",
                    "gas_rate": "AI_002", 
                    "water_rate": "AI_003",
                    "pressure": "AI_004",
                    "status": "DI_001"
                }
            }
            # More wells would be added here
        }
    
    def start_streaming(self):
        """Start SCADA streaming"""
        super().start_streaming()
        
        # Start SCADA polling thread
        scada_thread = threading.Thread(target=self._scada_polling_loop, daemon=True)
        scada_thread.start()
        
        return scada_thread
    
    def _scada_polling_loop(self):
        """Main SCADA polling loop"""
        while self.is_streaming:
            try:
                # Poll each well
                for well_id, mapping in self.well_mappings.items():
                    data_point = self._read_well_data(well_id, mapping)
                    if data_point:
                        self.data_queue.put(data_point)
                
                # Poll every 30 seconds
                time.sleep(30)
                
            except Exception as e:
                self.logger.error(f"SCADA polling error: {e}")
                time.sleep(60)  # Wait before retrying
    
    def _read_well_data(self, well_id: str, mapping: Dict) -> Optional[ProductionDataPoint]:
        """Read data for a specific well"""
        try:
            # This is a simplified example - real implementation would use
            # Modbus TCP, OPC UA, or other industrial protocols
            
            # Simulate reading tags (replace with actual SCADA communication)
            tags = mapping["tags"]
            
            # Read current values
            oil_rate = self._read_tag_value(tags.get("oil_rate"))
            gas_rate = self._read_tag_value(tags.get("gas_rate"))
            water_rate = self._read_tag_value(tags.get("water_rate"))
            pressure = self._read_tag_value(tags.get("pressure"))
            status = self._read_tag_status(tags.get("status"))
            
            return ProductionDataPoint(
                timestamp=datetime.now().isoformat(),
                well_id=well_id,
                api_number=mapping["api_number"],
                oil_rate=oil_rate,
                gas_rate=gas_rate,
                water_rate=water_rate,
                pressure=pressure,
                temperature=None,  # Not available in this example
                status=status,
                metadata={"source": "SCADA", "host": self.scada_host}
            )
            
        except Exception as e:
            self.logger.error(f"Error reading well data for {well_id}: {e}")
            return None
    
    def _read_tag_value(self, tag: str) -> Optional[float]:
        """Read numeric tag value from SCADA system"""
        # Placeholder - implement actual SCADA communication
        # Could use pymodbus, opcua, or other libraries
        import random
        return random.uniform(50, 200)  # Simulated value
    
    def _read_tag_status(self, tag: str) -> str:
        """Read status tag from SCADA system"""
        # Placeholder - implement actual SCADA communication
        import random
        return random.choice(["producing", "shut-in", "offline"])


class WebSocketStreamingClient(StreamingDataClient):
    """WebSocket-based streaming client"""
    
    def __init__(self, websocket_url: str, credential_key: str = None,
                 output_directory: str = None):
        super().__init__("WebSocket", output_directory)
        self.websocket_url = websocket_url
        self.credential_key = credential_key
        self.ws = None
        
        # Get credentials if provided
        if credential_key:
            cred_manager = CredentialManager()
            self.credentials = cred_manager.get_credentials(credential_key)
        else:
            self.credentials = {}
    
    def start_streaming(self):
        """Start WebSocket streaming"""
        super().start_streaming()
        
        # Start WebSocket connection
        ws_thread = threading.Thread(target=self._websocket_loop, daemon=True)
        ws_thread.start()
        
        return ws_thread
    
    def _websocket_loop(self):
        """WebSocket connection loop"""
        while self.is_streaming:
            try:
                # Create WebSocket connection
                self.ws = websocket.create_connection(self.websocket_url)
                self.logger.info(f"WebSocket connected to {self.websocket_url}")
                
                # Send authentication if needed
                if self.credentials.get('token'):
                    auth_msg = {
                        "type": "authenticate",
                        "token": self.credentials['token']
                    }
                    self.ws.send(json.dumps(auth_msg))
                
                # Listen for messages
                while self.is_streaming:
                    try:
                        message = self.ws.recv()
                        data_point = self._parse_websocket_message(message)
                        if data_point:
                            self.data_queue.put(data_point)
                    except websocket.WebSocketTimeoutError:
                        continue
                    except websocket.WebSocketConnectionClosedException:
                        break
                
            except Exception as e:
                self.logger.error(f"WebSocket connection error: {e}")
                time.sleep(30)  # Wait before reconnecting
            finally:
                if self.ws:
                    self.ws.close()
    
    def _parse_websocket_message(self, message: str) -> Optional[ProductionDataPoint]:
        """Parse incoming WebSocket message"""
        try:
            data = json.loads(message)
            
            # Expected format varies by data source
            if data.get("type") == "production_data":
                return ProductionDataPoint(
                    timestamp=data.get("timestamp", datetime.now().isoformat()),
                    well_id=data.get("well_id"),
                    api_number=data.get("api_number"),
                    oil_rate=data.get("oil_rate"),
                    gas_rate=data.get("gas_rate"),
                    water_rate=data.get("water_rate"),
                    pressure=data.get("pressure"),
                    temperature=data.get("temperature"),
                    status=data.get("status", "unknown"),
                    metadata=data.get("metadata", {})
                )
        
        except Exception as e:
            self.logger.error(f"Error parsing WebSocket message: {e}")
        
        return None


class RESTPollingClient(StreamingDataClient):
    """REST API polling client"""
    
    def __init__(self, api_base_url: str, api_key: str = None,
                 credential_key: str = None, poll_interval: int = 300,
                 output_directory: str = None):
        super().__init__("REST_API", output_directory)
        self.api_base_url = api_base_url.rstrip('/')
        self.api_key = api_key
        self.credential_key = credential_key
        self.poll_interval = poll_interval
        
        # Get credentials if provided
        if credential_key:
            cred_manager = CredentialManager()
            creds = cred_manager.get_credentials(credential_key)
            self.api_key = creds.get('api_key', api_key)
        
        # Setup headers
        self.headers = {'Content-Type': 'application/json'}
        if self.api_key:
            self.headers['Authorization'] = f'Bearer {self.api_key}'
    
    def start_streaming(self):
        """Start REST API polling"""
        super().start_streaming()
        
        # Start polling thread
        poll_thread = threading.Thread(target=self._polling_loop, daemon=True)
        poll_thread.start()
        
        return poll_thread
    
    def _polling_loop(self):
        """Main polling loop"""
        while self.is_streaming:
            try:
                # Get production data from API
                production_data = self._fetch_production_data()
                
                if production_data:
                    for data_point in production_data:
                        self.data_queue.put(data_point)
                
                # Wait for next poll
                time.sleep(self.poll_interval)
                
            except Exception as e:
                self.logger.error(f"REST polling error: {e}")
                time.sleep(60)  # Wait before retrying
    
    def _fetch_production_data(self) -> List[ProductionDataPoint]:
        """Fetch production data from REST API"""
        try:
            # Get current production data
            response = requests.get(
                f"{self.api_base_url}/production/current",
                headers=self.headers,
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json()
            data_points = []
            
            # Parse response (format depends on API)
            for well_data in data.get('wells', []):
                data_point = ProductionDataPoint(
                    timestamp=well_data.get("timestamp", datetime.now().isoformat()),
                    well_id=well_data.get("well_id"),
                    api_number=well_data.get("api_number"),
                    oil_rate=well_data.get("oil_rate"),
                    gas_rate=well_data.get("gas_rate"),
                    water_rate=well_data.get("water_rate"),
                    pressure=well_data.get("pressure"),
                    temperature=well_data.get("temperature"),
                    status=well_data.get("status", "unknown"),
                    metadata={"source": "REST_API", "poll_time": datetime.now().isoformat()}
                )
                data_points.append(data_point)
            
            return data_points
            
        except Exception as e:
            self.logger.error(f"Error fetching production data: {e}")
            return []


class StreamingDataManager:
    """Manager for multiple streaming data sources"""
    
    def __init__(self, output_directory: str = None):
        self.output_directory = Path(output_directory) if output_directory else Path('./streaming_data')
        self.output_directory.mkdir(parents=True, exist_ok=True)
        
        self.logger = logging.getLogger(__name__)
        self.clients = {}
        self.aggregated_data = Queue()
        
        # Real-time analytics
        self.analytics_callbacks = []
        self.alerting_rules = []
    
    def add_client(self, client: StreamingDataClient):
        """Add streaming client"""
        self.clients[client.name] = client
        
        # Add callback to aggregate data
        client.add_callback(self._aggregate_data_callback)
        
        self.logger.info(f"Added streaming client: {client.name}")
    
    def _aggregate_data_callback(self, data_point: ProductionDataPoint):
        """Callback to aggregate data from all sources"""
        self.aggregated_data.put(data_point)
        
        # Run real-time analytics
        for callback in self.analytics_callbacks:
            try:
                callback(data_point)
            except Exception as e:
                self.logger.error(f"Analytics callback error: {e}")
        
        # Check alerting rules
        self._check_alerts(data_point)
    
    def add_analytics_callback(self, callback: Callable[[ProductionDataPoint], None]):
        """Add real-time analytics callback"""
        self.analytics_callbacks.append(callback)
    
    def add_alerting_rule(self, rule: Dict):
        """Add alerting rule"""
        self.alerting_rules.append(rule)
    
    def _check_alerts(self, data_point: ProductionDataPoint):
        """Check alerting rules against data point"""
        for rule in self.alerting_rules:
            try:
                if self._evaluate_rule(rule, data_point):
                    self._trigger_alert(rule, data_point)
            except Exception as e:
                self.logger.error(f"Alert rule evaluation error: {e}")
    
    def _evaluate_rule(self, rule: Dict, data_point: ProductionDataPoint) -> bool:
        """Evaluate alerting rule"""
        # Simple rule evaluation (could be enhanced with complex expressions)
        field = rule.get('field')
        operator = rule.get('operator')  # >, <, ==, etc.
        threshold = rule.get('threshold')
        
        if not all([field, operator, threshold]):
            return False
        
        value = getattr(data_point, field, None)
        if value is None:
            return False
        
        if operator == '>':
            return value > threshold
        elif operator == '<':
            return value < threshold
        elif operator == '==':
            return value == threshold
        elif operator == '>=':
            return value >= threshold
        elif operator == '<=':
            return value <= threshold
        
        return False
    
    def _trigger_alert(self, rule: Dict, data_point: ProductionDataPoint):
        """Trigger alert"""
        alert = {
            'timestamp': datetime.now().isoformat(),
            'rule_name': rule.get('name', 'Unnamed Rule'),
            'well_id': data_point.well_id,
            'field': rule.get('field'),
            'value': getattr(data_point, rule.get('field')),
            'threshold': rule.get('threshold'),
            'severity': rule.get('severity', 'warning'),
            'message': rule.get('message', 'Alert condition met')
        }
        
        self.logger.warning(f"ALERT: {alert['message']} - {data_point.well_id}")
        
        # Save alert
        alert_file = self.output_directory / "alerts.jsonl"
        with open(alert_file, 'a') as f:
            f.write(json.dumps(alert) + '\n')
    
    def start_all_streaming(self):
        """Start all streaming clients"""
        threads = []
        for client in self.clients.values():
            thread = client.start_streaming()
            threads.append(thread)
        
        self.logger.info(f"Started {len(self.clients)} streaming clients")
        return threads
    
    def stop_all_streaming(self):
        """Stop all streaming clients"""
        for client in self.clients.values():
            client.stop_streaming()
        
        self.logger.info("All streaming clients stopped")
    
    def get_streaming_summary(self) -> Dict:
        """Get summary of streaming status"""
        return {
            'active_clients': len(self.clients),
            'client_names': list(self.clients.keys()),
            'output_directory': str(self.output_directory),
            'analytics_callbacks': len(self.analytics_callbacks),
            'alerting_rules': len(self.alerting_rules)
        }


# Example usage and configuration
def setup_production_monitoring(config: Dict) -> StreamingDataManager:
    """Setup production monitoring from configuration"""
    
    manager = StreamingDataManager(config.get('output_directory'))
    
    # Add SCADA client if configured
    if 'scada' in config:
        scada_config = config['scada']
        scada_client = SCADAStreamingClient(
            scada_host=scada_config['host'],
            scada_port=scada_config.get('port', 502),
            credential_key=scada_config.get('credential_key'),
            output_directory=config.get('output_directory')
        )
        manager.add_client(scada_client)
    
    # Add WebSocket client if configured
    if 'websocket' in config:
        ws_config = config['websocket']
        ws_client = WebSocketStreamingClient(
            websocket_url=ws_config['url'],
            credential_key=ws_config.get('credential_key'),
            output_directory=config.get('output_directory')
        )
        manager.add_client(ws_client)
    
    # Add REST client if configured
    if 'rest_api' in config:
        rest_config = config['rest_api']
        rest_client = RESTPollingClient(
            api_base_url=rest_config['base_url'],
            credential_key=rest_config.get('credential_key'),
            poll_interval=rest_config.get('poll_interval', 300),
            output_directory=config.get('output_directory')
        )
        manager.add_client(rest_client)
    
    # Add alerting rules
    for rule in config.get('alerting_rules', []):
        manager.add_alerting_rule(rule)
    
    return manager