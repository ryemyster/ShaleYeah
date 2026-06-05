# Integration — @shaleyeah/server-qa

## Who calls qa-server?

The `quality-assurance` agent (`agents/quality-assurance/`) connects over HTTP.

## Example call (agent side)

```typescript
import { callQaServerTool } from "./qa-server-client.js";

const result = await callQaServerTool(
    "http://localhost:3014",
    "run_quality_tests",
    {
        servers: ["geowiz", "econobot", "drilling"],
        accuracyThreshold: 0.95,
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `run_quality_tests` | `servers`, `accuracyThreshold` | `{ status, issues, recommendations }` |
| `generate_quality_report` | `testResults`, `context` | Full quality report document |

## Upstream dependencies

QA server receives inputs from the caller — no external data calls.

```
quality-assurance agent (port 4014)
  → qa-server (port 3014)
      ↓ callLLM()
  Anthropic API
```

## Downstream consumers

```
qa-server (port 3014)
  ↑ MCP over HTTP
quality-assurance agent (port 4014)
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout — retry" }
{ "error_type": "permanent", "message": "accuracyThreshold must be 0–1" }
```
