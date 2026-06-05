# Architecture — @shaleyeah/development-planner

> **Status: Planned** — Not yet implemented. See [#373](https://github.com/ryemyster/ShaleYeah/issues/373).

## Planned topology

```
Orchestrator / Caller
        │
        ▼
┌──────────────────────────────┐
│ @shaleyeah/development-      │  Tier 2 — ReAct loop + governance
│ planner (port 4011)          │
└────────────┬─────────────────┘
             │ MCP/HTTP
             ▼
┌────────────────────────┐
│ @shaleyeah/server-     │  Tier 1 — stateless tool server
│ development (port 3011)│
└────────────────────────┘
```

## Planned tools

| Tool | Type | Model | Description |
|------|------|-------|-------------|
| `development-planner.well_spacing` | query | standard-analysis | Optimal inter-well spacing and stacking |
| `development-planner.pad_layout` | query | standard-analysis | Pad location and wellbore geometry |
| `development-planner.infill_opportunity` | query | standard-analysis | Identify undrained intervals |
| `development-planner.development_schedule` | query | deep-reasoning | Phased drill sequence with capital pacing |
| `development-planner.recovery_uplift` | query | standard-analysis | Incremental recovery from infill |
