# Integration — @shaleyeah/server-development

## Who calls development?

The `development-planner` agent (`agents/development-planner/`) connects over HTTP.

## Example call (agent side)

```typescript
import { callDevelopmentTool } from "./development-client.js";

const result = await callDevelopmentTool(
    "http://localhost:3011",
    "create_development_plan",
    {
        wellCount: 8,
        acreage: 2400,
        targetFormation: "Wolfcamp A",
        budget: 48000000,
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `create_development_plan` | `wellCount`, `acreage`, `targetFormation`, `budget` | Development plan with schedule and risks |
| `monitor_development_progress` | `planId`, `currentStatus` | Progress metrics vs. plan |

## Upstream dependencies

Development is self-contained — no external data calls.

```
development (port 3011)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
development (port 3011)
  ↑ MCP over HTTP
development-planner agent (port 4011)
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout — retry" }
{ "error_type": "permanent", "message": "wellCount must be a positive integer" }
```
