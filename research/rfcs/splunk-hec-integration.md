# RFC: Splunk HTTP Event Collector (HEC) Integration

**Status**: Draft  
**Author**: Research-Hub Agent  
**Created**: 2025-01-18  
**Target**: SHALE YEAH telemetry and monitoring integration

## Executive Summary

Splunk HTTP Event Collector (HEC) integration will enable SHALE YEAH to send telemetry, audit logs, and operational data to enterprise Splunk deployments. This provides immediate operational visibility and integrates SHALE YEAH workflows into existing enterprise monitoring infrastructure.

**Business Value**: 
- Enterprise operational visibility
- Audit trail for regulatory compliance  
- Real-time monitoring of geological data processing
- Integration with existing SOC/SIEM workflows

**Implementation Effort**: Low (2-3 days)

## Technical Specification

### API Endpoints

**Base URL**: `https://<splunk-server>:8088`

**Primary Endpoint**: 
- `POST /services/collector` - Send events to default index
- `POST /services/collector/event` - Send events with metadata
- `POST /services/collector/raw` - Send raw data

### Authentication

**HEC Token**: Bearer token authentication via Authorization header
```
Authorization: Splunk <HEC_TOKEN>
```

**Environment Configuration**:
```bash
SPLUNK_HEC_URL=https://splunk.company.com:8088
SPLUNK_HEC_TOKEN=<uuid-token>
SPLUNK_INDEX=shale_yeah  # optional, defaults to main
```

### Event Format

**Standard JSON Event**:
```json
{
  "time": 1642534800,
  "host": "shale-yeah-agent",
  "source": "geowiz",
  "sourcetype": "shale:geological",
  "index": "shale_yeah",
  "event": {
    "run_id": "20250118-143022",
    "agent": "geowiz",
    "action": "zone_analysis_complete",
    "well_name": "Demo Well #1",
    "formations_identified": 3,
    "depth_range": "6800-7200ft",
    "confidence_score": 0.85,
    "processing_time_ms": 2340
  }
}
```

### Rate Limits and Best Practices

- **Rate Limit**: 100 requests/second (typical)
- **Batch Size**: Up to 1MB per request
- **Retry Logic**: Exponential backoff on 429/503 errors
- **SSL/TLS**: Always use HTTPS in production

## Integration Approach

### Implementation Strategy

1. **Environment-Based Configuration**
   - Optional integration - only activate if `SPLUNK_HEC_TOKEN` is set
   - Graceful degradation if Splunk is unavailable
   - No impact on core SHALE YEAH functionality

2. **Event Categories**
   - **Audit Events**: Agent starts/stops, user actions
   - **Processing Events**: Data ingestion, analysis completion
   - **Error Events**: Failures, exceptions, data quality issues
   - **Performance Events**: Processing times, resource usage

3. **Data Privacy**
   - No sensitive geological data in events
   - Aggregate metrics and metadata only
   - Configurable data filtering

### Required Dependencies

```json
{
  "dependencies": {
    "node-fetch": "^3.3.0",
    "retry": "^0.13.1"
  }
}
```

### Error Handling

- **Network Failures**: Log locally, retry with backoff
- **Authentication Errors**: Log warning, disable HEC integration
- **Rate Limiting**: Implement queue with exponential backoff
- **Malformed Events**: Log error, continue processing

## Code Examples

### Basic HEC Client

```typescript
import fetch from 'node-fetch';

interface HECEvent {
  time?: number;
  host?: string;
  source?: string;
  sourcetype?: string;
  index?: string;
  event: any;
}

class SplunkHECClient {
  private readonly url: string;
  private readonly token: string;
  private readonly index: string;

  constructor(url: string, token: string, index = 'main') {
    this.url = url;
    this.token = token;
    this.index = index;
  }

  async sendEvent(event: HECEvent): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/services/collector/event`, {
        method: 'POST',
        headers: {
          'Authorization': `Splunk ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          time: Math.floor(Date.now() / 1000),
          host: 'shale-yeah',
          index: this.index,
          ...event
        })
      });

      return response.ok;
    } catch (error) {
      console.warn('Splunk HEC error:', error);
      return false;
    }
  }
}
```

### Integration Usage

```typescript
// In agent workflows
const splunk = process.env.SPLUNK_HEC_TOKEN ? 
  new SplunkHECClient(
    process.env.SPLUNK_HEC_URL!,
    process.env.SPLUNK_HEC_TOKEN,
    process.env.SPLUNK_INDEX || 'shale_yeah'
  ) : null;

// Send telemetry
await splunk?.sendEvent({
  source: 'geowiz',
  sourcetype: 'shale:geological',
  event: {
    run_id: process.env.RUN_ID,
    action: 'analysis_complete',
    formations_count: 3,
    processing_time_ms: 2340
  }
});
```

## Implementation Plan

### Phase 1: Basic Integration (1 day)
- Create HEC client class
- Environment-based configuration
- Basic event sending for agent lifecycle

### Phase 2: Comprehensive Telemetry (1 day)  
- Add telemetry to all core agents
- Performance and error event tracking
- Data quality and processing metrics

### Phase 3: Advanced Features (1 day)
- Event batching and queuing
- Retry logic with exponential backoff
- Configurable event filtering

### Testing and Validation

1. **Unit Tests**: HEC client functionality and error handling
2. **Integration Tests**: End-to-end event flow to test Splunk instance
3. **Performance Tests**: Event throughput and retry behavior
4. **Security Tests**: Token handling and data privacy validation

## Deployment and Maintenance

### Configuration Template
```bash
# Splunk HEC Integration (Optional)
SPLUNK_HEC_URL=https://your-splunk.company.com:8088
SPLUNK_HEC_TOKEN=your-hec-token-here
SPLUNK_INDEX=shale_yeah
```

### Monitoring
- HEC client success/failure rates
- Event queue depth and processing times
- Network connectivity and authentication status

### Maintenance
- Token rotation procedures
- Index management and retention policies
- Dashboard and alert configuration in Splunk

## References

1. **Splunk HEC Documentation**: https://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector
2. **HEC REST API Reference**: https://docs.splunk.com/Documentation/Splunk/latest/RESTREF/RESTinput#services.2Fcollector
3. **Best Practices Guide**: https://docs.splunk.com/Documentation/Splunk/latest/Data/HTTPEventCollectorbest practices
4. **Node.js Examples**: https://github.com/splunk/splunk-javascript-logging

## Risk Assessment

**Low Risk Integration**:
- Optional and non-blocking
- Well-documented and stable API
- Minimal dependencies
- Graceful degradation on failures

**Mitigation Strategies**:
- Environment-based activation
- Comprehensive error handling
- Local logging fallback
- Performance monitoring

---

*Generated by SHALE YEAH Research-Hub Agent*

Generated with SHALE YEAH (c) Ryan McDonald / Ascendvent LLC - Apache-2.0