# Architecture — @shaleyeah/server-market

## Role

Tier 1 MCP tool server. Provides commodity price data (WTI crude, Henry Hub gas) and market trend analysis. Paired with the `market-analyst` agent (port 4007).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `analyze_market_conditions` | `synthesizeMarketAnalysisWithLLM()` | ✅ `callLLM` | Trend analysis, price forecast, supply/demand for a commodity + region |
| `competitive_analysis` | `synthesizeCompetitorAnalysisWithLLM()` | ✅ `callLLM` | Competitor activity and positioning in a basin |

## Price data source

`fetchEiaPrices()` calls the EIA API when `EIA_API_KEY` is set. Without it, falls back to `STUB_OIL_PRICE` / `STUB_GAS_PRICE` constants. Results are cached in-process to avoid redundant API calls. `clearEiaCache()` is exported for tests.

## LLM + fallback pattern

After fetching prices, calls `callLLM()` once to interpret the market environment. Falls back to `deriveDefaultMarketInterpretation(oilPrice, gasPrice)` and `deriveDefaultCompetitorProfile(company, market)` if the API is unavailable.

## Key exports

`deriveDefaultMarketInterpretation()`, `deriveDefaultCompetitorProfile()`, and `clearEiaCache()` — all exported for tests.

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3007`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: analyze_market_conditions { commodity, region, timeframe }
  → fetchEiaPrices()                  # EIA API or stub
  → synthesizeMarketAnalysisWithLLM() → callLLM()
  ↘ fallback: deriveDefaultMarketInterpretation()
```

## Dependencies

```
@shaleyeah/server-market
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```

See `docs/EIA_API_SETUP.md` for EIA API configuration.
