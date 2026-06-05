# Architecture — @shaleyeah/drilling-engineer

> **Status: Planned** — Not yet implemented. See [#374](https://github.com/ryemyster/ShaleYeah/issues/374).

## Planned topology

```
Orchestrator / Caller
        │
        ▼
┌──────────────────────────────┐
│ @shaleyeah/drilling-engineer │  Tier 2 — ReAct loop + governance
│ (port 4003)                  │  LocalAgentRuntime: HITL · scope · audit
└────────────┬─────────────────┘
             │ MCP/HTTP
             ▼
┌────────────────────────┐
│ @shaleyeah/server-     │  Tier 1 — stateless tool server
│ drilling (port 3003)   │  Zod-validated inputs, structured error types
└────────────────────────┘
```

## Planned tools

| Tool | Type | Model | Description |
|------|------|-------|-------------|
| `drilling-engineer.wellbore_design` | query | standard-analysis | Wellbore trajectory and casing program |
| `drilling-engineer.afe_estimate` | query | standard-analysis | Authority-for-expenditure cost estimate |
| `drilling-engineer.bha_selection` | query | standard-analysis | Bottom-hole assembly configuration |
| `drilling-engineer.hazard_assessment` | query | deep-reasoning | Formation pressure and drilling hazard flags |
| `drilling-engineer.mud_program` | query | standard-analysis | Drilling fluid design |

## Arcade patterns

All Tier 2 agents implement the same six Arcade governance patterns. See `agents/geologist/docs/ARCHITECTURE.md` for the complete reference implementation.
