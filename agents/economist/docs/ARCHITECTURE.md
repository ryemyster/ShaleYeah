# Architecture — @shaleyeah/economist

> **Status: Planned** — Not yet implemented. See [#364](https://github.com/ryemyster/ShaleYeah/issues/364).

## Planned topology

```
Orchestrator / Caller
        │
        ▼
┌────────────────────────┐
│  @shaleyeah/economist  │  Tier 2 — ReAct loop + governance
│  (port 4002)           │  LocalAgentRuntime: HITL · scope · audit
└────────────┬───────────┘
             │ MCP/HTTP  StreamableHTTPClientTransport
             ▼
┌────────────────────────┐
│ @shaleyeah/server-     │  Tier 1 — stateless tool server
│ econobot (port 3002)   │  Zod-validated inputs, structured error types
└────────────────────────┘
```

## Planned tools

| Tool | Type | Model | Description |
|------|------|-------|-------------|
| `economist.npv_analysis` | query | standard-analysis | Net present value at given discount rates |
| `economist.irr_analysis` | query | standard-analysis | Internal rate of return |
| `economist.breakeven_price` | query | standard-analysis | Commodity price required to break even |
| `economist.sensitivity_table` | query | standard-analysis | NPV sensitivity across price/cost ranges |
| `economist.capital_budget` | query | standard-analysis | Capital spend schedule and funding needs |

## Arcade patterns

All Tier 2 agents implement the same six Arcade governance patterns. See `agents/geologist/docs/ARCHITECTURE.md` for the complete reference implementation.
