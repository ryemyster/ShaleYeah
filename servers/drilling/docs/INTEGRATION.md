# Integration — @shaleyeah/server-drilling

## Who calls drilling?

The `drilling-engineer` agent (`agents/drilling-engineer/`) connects to drilling over HTTP using `StreamableHTTPClientTransport`.

## Example call (agent side)

```typescript
import { callDrillingTool } from "./drilling-client.js";

const result = await callDrillingTool(
    "http://localhost:3003",
    "design_drilling_program",
    {
        wellParameters: {
            targetDepth: 10500,
            wellType: "horizontal",
            formation: "wolfcamp",
        },
        location: {
            latitude: 31.9686,
            longitude: -99.9018,
            surface: "Midland Basin surface pad",
        },
        constraints: {
            budget: 8000000,
            timeline: "Q3 2026",
            environmental: ["water disposal", "flaring restriction"],
        },
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `design_drilling_program` | `wellParameters`, `location` | Full program: trajectory, casing, costs, risks, interpretation |

## Upstream dependencies

No upstream MCP servers. Reads from Anthropic API only.

```
drilling (port 3003)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
drilling (port 3003)
  ↑ MCP over HTTP
drilling-engineer agent (port 4003)
  ↑ LocalAgentRuntime
Orchestrator / API client
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout" }
{ "error_type": "permanent", "message": "Invalid well type" }
```
