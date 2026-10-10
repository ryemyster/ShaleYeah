# Architecture — @shaleyeah/reservoir-engineer

> **Status: Planned** — Not yet implemented. See [#365](https://github.com/ryemyster/ShaleYeah/issues/365).

## Planned topology

```
Orchestrator / Caller
        │
        ▼
┌─────────────────────────────────┐
│ @shaleyeah/reservoir-engineer   │  Tier 2 — ReAct loop + governance
│ (port 4004)                     │  LocalAgentRuntime: HITL · scope · audit
└────────────┬────────────────────┘
             │ MCP/HTTP
             ▼
┌────────────────────────┐
│ @shaleyeah/server-     │  Tier 1 — stateless tool server
│ curve-smith (port 3004)│
└────────────────────────┘
```

## Planned tools

| Tool | Type | Model | Description |
|------|------|-------|-------------|
| `reservoir-engineer.decline_analysis` | query | standard-analysis | Arps decline curve fit and EUR |
| `reservoir-engineer.production_forecast` | query | standard-analysis | Type-curve based production forecast |
| `reservoir-engineer.petrophysics` | query | standard-analysis | Porosity, permeability, and water saturation from logs |
| `reservoir-engineer.material_balance` | query | deep-reasoning | Volumetric in-place estimation |
| `reservoir-engineer.recovery_factor` | query | standard-analysis | Expected recovery efficiency |

## Arcade patterns

All Tier 2 agents implement the same six Arcade governance patterns. See `agents/geologist/docs/ARCHITECTURE.md` for the complete reference.
