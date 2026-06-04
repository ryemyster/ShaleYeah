# Architecture — @shaleyeah/server-econobot

## Role

Tier 1 MCP tool server. Provides financial modeling tools — discounted cash flow, IRR, NPV, and investment screening.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `analyze_economics` | ✅ `callLLM` | Full economic analysis: DCF, NPV, IRR, payback |
| `calculate_dcf` | ✅ `callLLM` | Discounted cash flow model with sensitivity |

## LLM pattern

Each tool constructs a prompt with the raw financial inputs (oil price, gas price, production forecast, costs) and calls `callLLM()` once. Fallback: `EconomicsSchema` Zod schema parses the LLM output; if parsing fails, deterministic DCF math is returned directly.

## Key imports from sdk

Uses `EconomicsSchema` from `@shaleyeah/sdk` (canonical-model) to validate and structure LLM output before returning it to callers.

## Dependencies

```
@shaleyeah/server-econobot
  └── @shaleyeah/sdk   (MCPServer, callLLM, EconomicsSchema)
```
