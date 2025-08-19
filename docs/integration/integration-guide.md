# SHALE YEAH Integration Guide

This guide covers the integration architecture and procedures for connecting SHALE YEAH to external systems.

## Integration Architecture

SHALE YEAH provides a layered integration approach:

```
┌─────────────────┐
│   SHALE YEAH    │
│  Control Plane  │
└─────────────────┘
         │
┌─────────────────┐
│  Integration    │
│     Layer       │
└─────────────────┘
         │
┌─────────────────┐
│   External      │
│    Systems      │
└─────────────────┘
```

## Available Integrations

### SIEM (Security Information and Event Management)

#### Splunk HEC Integration
```bash
# Configuration
export SPLUNK_HEC_TOKEN=your-token-here
export SPLUNK_HEC_URL=https://splunk.company.com:8088/services/collector

# Usage
python integrations/siem/splunk_connector.py --run-id $RUN_ID
```

**Features:**
- Real-time event streaming
- Custom source types for geological and economic data
- Automatic field extraction
- Dashboard templates included

#### Microsoft Sentinel Integration
```bash
# Configuration  
export SENTINEL_BEARER=your-bearer-token
export SENTINEL_WORKSPACE_ID=your-workspace-id

# Usage
python integrations/siem/sentinel_connector.py --run-id $RUN_ID
```

**Features:**
- Log Analytics workspace integration
- Custom data connectors
- KQL query templates
- Security incident correlation

#### QRadar Integration
```bash
# Configuration
export QRADAR_API_TOKEN=your-api-token
export QRADAR_HOST=qradar.company.com

# Usage
python integrations/siem/qradar_connector.py --format LEEF --run-id $RUN_ID
```

**Features:**
- LEEF format event forwarding
- Custom DSM (Device Support Module)
- Rule templates for oil & gas events
- Offense correlation

### GIS (Geographic Information Systems)

#### ArcGIS REST API
```bash
# Configuration
export ARCGIS_SERVER_URL=https://gis.company.com/server/rest/services
export ARCGIS_TOKEN=your-token

# Usage
python integrations/gis/arcgis_connector.py --feature-service tract_analysis
```

**Features:**
- Feature service publishing
- Spatial analysis services
- Map service creation
- Geocoding integration

#### QGIS Processing
```bash
# Usage (requires QGIS installation)
python integrations/gis/qgis_processor.py --project tract_analysis.qgs --algorithm native:buffer
```

**Features:**
- Headless QGIS processing
- Custom algorithm chains
- Batch spatial operations
- Output format flexibility

#### MapInfo Professional
```bash
# Usage (requires MapInfo installation)
python integrations/gis/mapinfo_connector.py --workspace tract_analysis.wor
```

### Mining Software Integration

#### Open Mining Format (OMF)
```bash
# Export geological zones to OMF
python integrations/mining/omf_export.py --zones zones.geojson --output tract.omf
```

**Features:**
- 3D geological model export
- Drill hole data integration
- Property interpolation
- Cross-platform compatibility

#### Leapfrog Geo Integration
```bash
# Configuration (requires Leapfrog installation)
export LEAPFROG_PROJECT_PATH=/path/to/project.lfp

# Usage
python integrations/mining/leapfrog_connector.py --import-zones zones.geojson
```

**Features:**
- Implicit geological modeling
- Structural interpretation
- Grade estimation
- Visualization integration

## Testing Integrations

### Unit Testing
```bash
# Test individual connectors
python -m pytest tests/integration/test_splunk_connector.py
python -m pytest tests/integration/test_arcgis_connector.py

# Test integration layer
python -m pytest tests/integration/test_integration_layer.py
```

### Integration Testing
```bash
# End-to-end integration tests (requires actual systems)
export TEST_INTEGRATION=true
python -m pytest tests/integration/test_end_to_end_integrations.py

# Mock integration testing (no external dependencies)
python -m pytest tests/integration/test_mock_integrations.py
```

### Manual Testing Procedures

#### SIEM Integration Testing
1. **Setup Test Environment**
   ```bash
   export RUN_ID=test-integration-$(date +%Y%m%d-%H%M%S)
   export OUT_DIR=./data/outputs/${RUN_ID}
   ```

2. **Run Test Pipeline**
   ```bash
   python mcp.py --goal tract_eval --run-id $RUN_ID
   ```

3. **Verify SIEM Events**
   - Check Splunk: `index=shaleyeah sourcetype=geological_analysis`
   - Check Sentinel: Query Log Analytics workspace
   - Check QRadar: Verify custom events in event viewer

4. **Validate Data Integrity**
   ```bash
   python scripts/validate-siem-integration.py --run-id $RUN_ID
   ```

#### GIS Integration Testing
1. **Prepare Test Data**
   ```bash
   python scripts/generate-test-geospatial-data.py --output test_data.geojson
   ```

2. **Test Spatial Operations**
   ```bash
   python integrations/gis/arcgis_connector.py --test-mode --input test_data.geojson
   ```

3. **Verify Spatial Results**
   - Check feature service publication
   - Validate coordinate systems
   - Test spatial queries

#### Mining Software Testing
1. **Export Test Data**
   ```bash
   python integrations/mining/omf_export.py --zones zones.geojson --output test_export.omf
   ```

2. **Validate OMF Structure**
   ```bash
   python scripts/validate-omf-export.py --file test_export.omf
   ```

3. **Test Import in Target Software**
   - Import OMF into target mining software
   - Verify geological interpretation
   - Test property visualization

## Adding New Integrations

### Step 1: Create Integration Stub
```bash
# Create directory structure
mkdir -p integrations/new_system/
touch integrations/new_system/__init__.py
touch integrations/new_system/connector.py
touch integrations/new_system/config.yaml
```

### Step 2: Implement Connector
```python
# integrations/new_system/connector.py
from shared import BaseAgent

class NewSystemConnector:
    def __init__(self, config: dict):
        self.config = config
        self.client = None
    
    def connect(self):
        """Establish connection to external system"""
        pass
    
    def send_data(self, data: dict):
        """Send data to external system"""
        pass
    
    def validate_connection(self):
        """Test connection and return status"""
        pass
```

### Step 3: Create Configuration
```yaml
# integrations/new_system/config.yaml
name: new_system
description: "Integration with New System"
version: "1.0.0"

connection:
  host: "${NEW_SYSTEM_HOST}"
  port: "${NEW_SYSTEM_PORT}"
  api_key: "${NEW_SYSTEM_API_KEY}"

data_mapping:
  geological_zones: "zones"
  economic_analysis: "economics"
  
error_handling:
  retry_attempts: 3
  timeout: 30
  
quality_gates:
  - name: "connection_test"
    validation: "connector.validate_connection()"
  - name: "data_format_validation" 
    validation: "validate_data_format(data)"
```

### Step 4: Add Tests
```python
# tests/integration/test_new_system.py
import pytest
from integrations.new_system.connector import NewSystemConnector

def test_connection():
    connector = NewSystemConnector({})
    assert connector.validate_connection() is True

def test_data_send():
    connector = NewSystemConnector({})
    test_data = {"test": "data"}
    result = connector.send_data(test_data)
    assert result is not None
```

### Step 5: Update Documentation
Add integration details to:
- `README.md` - Integration list
- `docs/integration/integration-guide.md` - This file
- `.claude/agents/*.yaml` - Agent configurations if needed

## Environment Configuration

### Development Environment
```bash
# Copy template
cp config/env/integration.env.template config/env/integration.env

# Edit with actual values
vim config/env/integration.env
```

### Production Environment
```bash
# Use environment-specific configuration
export ENVIRONMENT=production
source config/env/production.env

# Verify integration configuration
python scripts/validate-integration-config.py
```

## Security Considerations

### API Key Management
- Never commit API keys to version control
- Use environment variables or secure vaults
- Rotate keys regularly
- Monitor API usage for anomalies

### Data Privacy
- Implement data redaction for sensitive information
- Use secure transport (TLS/SSL) for all connections
- Log access attempts for audit trails
- Follow data retention policies

### Network Security  
- Use VPNs for production integrations
- Implement IP whitelisting where possible
- Monitor network traffic for security events
- Use service accounts with minimal privileges

## Troubleshooting

### Common Integration Issues

#### Connection Failures
1. **Check Network Connectivity**
   ```bash
   ping external-system.company.com
   telnet external-system.company.com 443
   ```

2. **Verify Credentials**
   ```bash
   python scripts/test-credentials.py --system splunk
   ```

3. **Check Firewall Rules**
   ```bash
   # Test specific ports
   nmap -p 8088,443,80 external-system.company.com
   ```

#### Data Format Issues
1. **Validate JSON Schema**
   ```bash
   python scripts/validate-json-schema.py --file output.json --schema schemas/geological.json
   ```

2. **Check Data Types**
   ```bash
   python scripts/analyze-data-types.py --input zones.geojson
   ```

#### Performance Issues
1. **Monitor Memory Usage**
   ```bash
   python -m memory_profiler integrations/gis/arcgis_connector.py
   ```

2. **Profile Integration Performance**
   ```bash
   python -m cProfile -o integration.prof integrations/siem/splunk_connector.py
   python -c "import pstats; pstats.Stats('integration.prof').sort_stats('time').print_stats(10)"
   ```

### Debug Mode
```bash
# Enable debug logging for integrations
export SHALE_YEAH_DEBUG=true
export INTEGRATION_LOG_LEVEL=DEBUG

# Run with verbose output
python integrations/siem/splunk_connector.py --verbose --run-id $RUN_ID
```

### Support Resources
- Integration logs: `logs/integrations/`
- Test scripts: `scripts/integration-tests/`
- Mock services: `tests/mocks/`
- Documentation: `docs/integration/`

---

*For additional support, create an issue in the GitHub repository with integration logs and system configuration details.*

Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0