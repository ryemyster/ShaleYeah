# Architecture — @shaleyeah/server-decision

## Role

Tier 1 MCP tool server. Synthesizes outputs from other domain servers into a final investment recommendation and bid strategy. Paired with the `investment-chair` agent (port 4013).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `make_investment_decision` | LLM + DecisionSchema | ✅ `callLLM` | Go/no-go recommendation from full domain synthesis |
| `calculate_bid_strategy` | LLM | ✅ `callLLM` | Recommended bid range and strategy |
| `analyze_portfolio_fit` | LLM | ✅ `callLLM` | Portfolio fit score and strategic rationale |

## LLM + fallback pattern

Takes structured inputs from other servers (geological confidence, NPV, IRR, risk score) as JSON, calls `callLLM()` once per tool, validates output against `DecisionSchema` from `@shaleyeah/sdk`. Falls back to deterministic defaults if the API is unavailable.

## Key exports

- `calculateRecommendedBid()` — deterministic bid calculation, exported for anti-stub testing
- `countDomainsPresent()` — counts how many domain scores are present in the input, exported for anti-stub testing

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3013`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: make_investment_decision { geologicalConfidence, npv, irr, riskScore, ... }
  → callLLM(investment decision prompt with all domain data)
  → DecisionSchema validation
  ↘ fallback: calculateRecommendedBid() + deterministic defaults
  → Return: { decision, rationale, confidence, bidRange }
```

## Dependencies

```
@shaleyeah/server-decision
  └── @shaleyeah/sdk   (MCPServer, callLLM, DecisionSchema)
```
