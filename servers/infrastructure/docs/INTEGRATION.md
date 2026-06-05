# Integration — @shaleyeah/server-infrastructure

## Who calls infrastructure?

The `infrastructure-planner` agent (`agents/infrastructure-planner/`) connects over HTTP.

## Example call (agent side)

```typescript
import { callInfrastructureTool } from "./infrastructure-client.js";

const result = await callInfrastructureTool(
    "http://localhost:3012",
    "plan_infrastructure",
    {
        wellCount: 8,
        productionRate: 1200,
        location: "Eddy County, NM",
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `plan_infrastructure` | `wellCount`, `productionRate`, `location` | `{ takeawayCapacity, facilitySizing, costEstimate, riskLevel }` |

## Upstream dependencies

Infrastructure is self-contained — no external data calls.

```
infrastructure (port 3012)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
infrastructure (port 3012)
  ↑ MCP over HTTP
infrastructure-planner agent (port 4012)
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout — retry" }
{ "error_type": "permanent", "message": "productionRate must be a positive number" }
```
