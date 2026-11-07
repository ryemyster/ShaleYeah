# Integration — @shaleyeah/server-decision

## Who calls decision?

The `investment-chair` agent (`agents/investment-chair/`) connects over HTTP, typically as the penultimate step before the reporter generates the final executive summary.

## Example call (agent side)

```typescript
import { callDecisionTool } from "./decision-client.js";

const result = await callDecisionTool(
    "http://localhost:3013",
    "make_investment_decision",
    {
        geologicalConfidence: 0.82,
        npv: 14500000,
        irr: 0.28,
        riskScore: 0.35,
        legalRisk: "low",
        marketOutlook: "favorable",
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `make_investment_decision` | `geologicalConfidence`, `npv`, `irr`, `riskScore` | `{ decision, rationale, confidence, bidRange }` |
| `calculate_bid_strategy` | `npv`, `irr`, `riskScore` | `{ recommendedBid, walkAwayPrice, strategy }` |
| `analyze_portfolio_fit` | `assetProfile`, `portfolioContext` | `{ fitScore, rationale }` |

## Upstream dependencies

Decision is self-contained — no external data calls. All inputs come from the caller.

```
All domain agents → investment-chair
investment-chair → decision (port 3013) → callLLM()
decision → Anthropic API
```

## Downstream consumers

```
decision (port 3013)
  ↑ MCP over HTTP
investment-chair agent (port 4013)
  → reporter server (port 3009) for final report
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout — retry" }
{ "error_type": "permanent", "message": "geologicalConfidence must be 0–1" }
```
