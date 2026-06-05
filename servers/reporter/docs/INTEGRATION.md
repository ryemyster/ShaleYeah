# Integration — @shaleyeah/server-reporter

## Who calls reporter?

The `reporter-agent` (`agents/reporter-agent/`) connects over HTTP, typically as the final step in the deal workflow after all domain agents have run.

## Example call (agent side)

```typescript
import { callReporterTool } from "./reporter-client.js";

const result = await callReporterTool(
    "http://localhost:3009",
    "create_executive_report",
    {
        dealName: "Permian Basin Acquisition",
        audience: "investment_committee",
        sections: {
            geology: geologySummary,
            economics: economicsSummary,
            risk: riskSummary,
            legal: legalSummary,
        },
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `synthesize_analysis` | `sections`, `context` | Combined multi-domain analysis |
| `generate_investment_decision` | `analysis`, `criteria` | Go/no-go with structured rationale |
| `create_executive_report` | `dealName`, `sections`, `audience` | Full executive summary document |

## Upstream dependencies

Reporter has no external data dependencies — it synthesizes data provided by the caller.

```
All domain agents (geowiz, econobot, drilling, ...)
  ↓ via reporter-agent
reporter (port 3009)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
reporter (port 3009)
  ↑ MCP over HTTP
reporter-agent (port 4009)
  ↓ result → orchestrator / user
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout — retry" }
{ "error_type": "permanent", "message": "Missing required section: dealName" }
```
