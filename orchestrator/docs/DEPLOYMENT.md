# Deployment — @shaleyeah/orchestrator

> **Status: Planned — #362**

## Current state

This package is a stub — no deployment configuration exists yet. See issue #362.

## Planned deployment

### Environment variables (planned)

| Variable | Required | Purpose |
|----------|----------|---------|
| `TEMPORAL_ADDRESS` | Yes | Temporal server address (e.g. `localhost:7233`) |
| `TEMPORAL_NAMESPACE` | No | Temporal namespace (default: `default`) |
| `ANTHROPIC_API_KEY` | Inherited | Passed through to agent calls |

### Planned Docker Compose (excerpt)

```yaml
services:
  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - "7233:7233"
  orchestrator:
    image: shaleyeah/orchestrator:latest
    environment:
      TEMPORAL_ADDRESS: temporal:7233
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [temporal]
    # depends_on: all 14 agent services
```

### Kong registration (planned)

```bash
curl -X POST http://kong:8001/services -d name=orchestrator -d host=orchestrator
curl -X POST http://kong:8001/services/orchestrator/routes -d paths[]=/api/deal
```

## Related

- Issue #362 — Temporal workflow implementation
