# Architecture — @shaleyeah/market-analyst

> **Status: Planned** — Not yet implemented. See [#371](https://github.com/ryemyster/ShaleYeah/issues/371).

## Planned topology

```
Orchestrator / Caller
        │
        ▼
┌──────────────────────────┐
│ @shaleyeah/market-analyst│  Tier 2 — ReAct loop + governance
│ (port 4007)              │
└────────────┬─────────────┘
             │ MCP/HTTP
             ▼
┌────────────────────────┐
│ @shaleyeah/server-     │  Tier 1 — stateless tool server
│ market (port 3007)     │
└────────────────────────┘
```

## Planned tools

| Tool | Type | Model | Description |
|------|------|-------|-------------|
| `market-analyst.price_forecast` | query | standard-analysis | Short/long-term commodity price outlook |
| `market-analyst.basis_differential` | query | standard-analysis | Location basis and marketing differentials |
| `market-analyst.hedge_analysis` | query | standard-analysis | Hedging strategy and protection levels |
| `market-analyst.supply_demand` | query | standard-analysis | Basin-level supply/demand balance |
| `market-analyst.comp_transactions` | query | standard-analysis | Comparable M&A transaction metrics |
