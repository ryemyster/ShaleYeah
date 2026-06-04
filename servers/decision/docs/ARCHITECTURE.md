# Architecture — @shaleyeah/server-decision

## Role

Tier 1 MCP tool server. Synthesizes outputs from other servers into a final investment go/no-go recommendation and bid strategy.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `screen_investment` | ✅ `callLLM` | Quick pass/fail screen against minimum thresholds |
| `analyze_investment` | ✅ `callLLM` | Full multi-domain investment analysis synthesis |
| `calculate_bid_strategy` | ✅ `callLLM` | Recommended bid range and strategy |
| `analyze_portfolio_fit` | ✅ `callLLM` | Portfolio fit score and strategic rationale |

## Key exports

`calculateRecommendedBid()` and `countDomainsPresent()` are exported pure functions used in tests to verify determinism (no hardcoded stub values).

## LLM pattern

Takes structured inputs from other servers (geological confidence, NPV, IRR, risk score) as JSON and calls `callLLM()` once to synthesize a recommendation. Uses `DecisionSchema` from `@shaleyeah/sdk` to validate structured output.

## Dependencies

```
@shaleyeah/server-decision
  └── @shaleyeah/sdk   (MCPServer, callLLM, DecisionSchema)
```
