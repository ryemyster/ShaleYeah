# Integration — @shaleyeah/server-curve-smith

## Who calls curve-smith?

The `reservoir-engineer` agent (`agents/reservoir-engineer/`) connects over HTTP.

## Example call (agent side)

```typescript
import { callCurveSmithTool } from "./curve-smith-client.js";

const result = await callCurveSmithTool(
    "http://localhost:3004",
    "analyze_decline_curve",
    {
        productionData: {
            wellName: "JONES 1H",
            dates: ["2024-01", "2024-02", "2024-03"],
            oilProduction: [850, 780, 710],
            gasProduction: [4200, 3900, 3550],
        },
        curveType: "hyperbolic",
        outputPath: "/data/curves/JONES_1H_decline.json",
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `analyze_decline_curve` | `productionData`, `curveType` | Arps parameters, EUR, interpretation |
| `generate_type_curve` | `wellData`, `basin` | Normalized type curve |
| `calculate_eur` | `declineParams` | EUR estimate with confidence range |
| `assess_curve_quality` | `productionData`, `curveParams` | Quality grade + fit metrics |

## Upstream dependencies

No upstream MCP servers — reads from Anthropic API only.

```
curve-smith (port 3004)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
curve-smith (port 3004)
  ↑ MCP over HTTP
reservoir-engineer agent (port 4004)
  ↑ LocalAgentRuntime
Orchestrator / API client
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout" }
{ "error_type": "permanent", "message": "Insufficient data points for curve fitting" }
```
