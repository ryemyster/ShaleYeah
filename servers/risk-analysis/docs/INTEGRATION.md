# Integration — @shaleyeah/server-risk-analysis

## Who calls risk-analysis?

The `risk-analyst` agent (`agents/risk-analyst/`) connects over HTTP.

## Example call (agent side)

```typescript
import { callRiskAnalysisTool } from "./risk-analysis-client.js";

const result = await callRiskAnalysisTool(
    "http://localhost:3005",
    "assess_investment_risk",
    {
        location: "Midland Basin, Texas",
        projectType: "development",
        npv: 4200000,
        irr: 0.28,
        geologicalConfidence: 0.82,
        riskProfile: "moderate",
        analysisDepth: "comprehensive",
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `assess_investment_risk` | `location`, `projectType`, `npv`, `irr` | `RiskProfile` with domain scores |
| `monte_carlo_simulation` | `baseCase`, `uncertaintyRanges`, `iterations` | P10/P50/P90 NPV distribution |

## Upstream dependencies

No upstream MCP servers — calls Anthropic API only.

```
risk-analysis (port 3005)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
risk-analysis (port 3005)
  ↑ MCP over HTTP
risk-analyst agent (port 4005)
  ↑ LocalAgentRuntime
Orchestrator / API client
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout" }
{ "error_type": "permanent", "message": "Invalid risk profile: unknown projectType" }
```
