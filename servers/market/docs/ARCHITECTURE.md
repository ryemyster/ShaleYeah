# Architecture — @shaleyeah/server-market

## Role

Tier 1 MCP tool server. Provides commodity price data (WTI crude, Henry Hub gas) and market trend analysis.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `analyze_market_conditions` | ✅ `callLLM` | Trend analysis, price forecast, supply/demand |
| `get_commodity_prices` | No | Live or stub WTI/Henry Hub prices |

## Price data source

`fetchEiaPrices()` calls the EIA API when `EIA_API_KEY` is set. Without it, falls back to `STUB_OIL_PRICE` / `STUB_GAS_PRICE` constants. Results are cached in-process to avoid redundant API calls. The cache is cleared by `clearEiaCache()` (exported for tests).

## Key exports

`deriveDefaultMarketInterpretation(oilPrice, gasPrice)` and `deriveDefaultCompetitorProfile(company, market)` — deterministic fallbacks, exported for anti-stub tests.

## Environment

Requires `EIA_API_KEY` for live prices. Without it, stubs are used silently. See `docs/EIA_API_SETUP.md`.

## Dependencies

```
@shaleyeah/server-market
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
