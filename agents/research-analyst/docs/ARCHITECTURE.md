# Architecture — @shaleyeah/research-analyst

> **Status: Planned** — Not yet implemented. See [#369](https://github.com/ryemyster/ShaleYeah/issues/369).

## Planned topology

```
Orchestrator / Caller
        │
        ▼
┌────────────────────────────┐
│ @shaleyeah/research-analyst│  Tier 2 — ReAct loop + governance
│ (port 4008)                │
└────────────┬───────────────┘
             │ MCP/HTTP
             ▼
┌────────────────────────┐
│ @shaleyeah/server-     │  Tier 1 — stateless tool server
│ research (port 3008)   │
└────────────────────────┘
```

## Planned tools

| Tool | Type | Model | Description |
|------|------|-------|-------------|
| `research-analyst.permit_search` | query | small-fast | State regulatory permit database lookups |
| `research-analyst.operator_activity` | query | standard-analysis | Recent drilling and completion activity |
| `research-analyst.literature_search` | query | standard-analysis | Technical paper and patent search |
| `research-analyst.competitor_profile` | query | standard-analysis | Operator acreage and activity summary |
| `research-analyst.analogous_wells` | query | standard-analysis | Statistical analogs from public data |
