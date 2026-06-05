# Architecture — @shaleyeah/infrastructure-planner

> **Status: Planned** — Not yet implemented. See [#375](https://github.com/ryemyster/ShaleYeah/issues/375).

## Planned topology

```
Orchestrator / Caller
        │
        ▼
┌────────────────────────────────┐
│ @shaleyeah/infrastructure-     │  Tier 2 — ReAct loop + governance
│ planner (port 4012)            │
└────────────┬───────────────────┘
             │ MCP/HTTP
             ▼
┌────────────────────────────┐
│ @shaleyeah/server-         │  Tier 1 — stateless tool server
│ infrastructure (port 3012) │
└────────────────────────────┘
```

## Planned tools

| Tool | Type | Model | Description |
|------|------|-------|-------------|
| `infrastructure-planner.pipeline_sizing` | query | standard-analysis | Pipeline diameter, pressure, and routing |
| `infrastructure-planner.compression_design` | query | standard-analysis | Compressor HP and station placement |
| `infrastructure-planner.swd_capacity` | query | standard-analysis | Saltwater disposal well capacity needs |
| `infrastructure-planner.facilities_capex` | query | standard-analysis | Surface facilities capital cost estimate |
| `infrastructure-planner.infrastructure_schedule` | query | deep-reasoning | Phased facilities build-out timeline |
