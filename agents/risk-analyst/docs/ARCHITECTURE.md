# Architecture — @shaleyeah/risk-analyst

> **Status: Planned** — Not yet implemented. See [#366](https://github.com/ryemyster/ShaleYeah/issues/366).

## Planned topology

```
Orchestrator / Caller
        │
        ▼
┌──────────────────────────┐
│  @shaleyeah/risk-analyst │  Tier 2 — ReAct loop + governance
│  (port 4005)             │  LocalAgentRuntime: HITL · scope · audit
└────────────┬─────────────┘
             │ MCP/HTTP
             ▼
┌──────────────────────────┐
│ @shaleyeah/server-       │  Tier 1 — stateless tool server
│ risk-analysis (port 3005)│  Note: uses Math.random() intentionally for Monte Carlo
└──────────────────────────┘
```

## Planned tools

| Tool | Type | Model | Description |
|------|------|-------|-------------|
| `risk-analyst.monte_carlo` | query | standard-analysis | Probability-weighted outcome distribution |
| `risk-analyst.risk_matrix` | query | standard-analysis | Likelihood × consequence risk ranking |
| `risk-analyst.sensitivity_tornado` | query | standard-analysis | Tornado chart of key value drivers |
| `risk-analyst.risked_value` | query | standard-analysis | Probability-weighted NPV (risked value) |
| `risk-analyst.project_ranking` | query | deep-reasoning | Portfolio-level project priority ranking |

## Note on Math.random()

`servers/risk-analysis` intentionally uses `Math.random()` (via `sampleUniform`, `sampleTriangular`, `sampleNormal`) for Monte Carlo sampling — this is an explicit exception to the no-`Math.random()` rule in `CLAUDE.md`.

## Arcade patterns

See `agents/geologist/docs/ARCHITECTURE.md` for the complete reference.
