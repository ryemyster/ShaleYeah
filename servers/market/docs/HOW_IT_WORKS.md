# How Market Works — @shaleyeah/server-market

## Plain language (12-year-old version)

Before you drill a well, you need to know: what is oil selling for today? What about natural gas? Is the market going up or down? Who are the other companies competing in this area?

Market is the expert who answers those questions. It fetches live prices from the U.S. Energy Information Administration (EIA), then asks Claude to explain what those prices mean for your investment — is the trend bullish, bearish, or neutral? It also profiles the competitors in the basin you're targeting.

If the EIA API isn't available, it uses reasonable stub prices so the rest of the analysis can continue.

## Technical explanation

Market is a **Tier 1 MCP tool server** — stateless, no session memory. It exposes 2 market intelligence tools.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `analyze_market_conditions` | Fetches EIA prices, runs LLM trend analysis for a commodity + region + timeframe |
| `competitive_analysis` | Profiles named competitors in a basin — market share, strategy, strengths |

### Request lifecycle

```
Agent (market-analyst)
  → MCP tool call: analyze_market_conditions { commodity, region, timeframe }
      ↓
  Market server (src/index.ts)
      ↓
  1. fetchEiaPrices()                   # EIA API → cached in-process
     OR stub prices (no EIA_API_KEY)
  2. synthesizeMarketAnalysisWithLLM()  → callLLM()
     OR fallback: deriveDefaultMarketInterpretation()
  3. Return: { current prices, trend, outlook, risks, opportunities }
```

### EIA price caching

Prices are cached in-process after the first fetch to avoid hitting the EIA rate limit on every tool call. The cache is cleared by `clearEiaCache()` (exported for tests).

### Transport modes

- **stdio** (default): pipe-based
- **HTTP** (when `PORT=3007`): `StreamableHTTPServerTransport` — used by the market-analyst agent
