# Architecture — @shaleyeah/title-analyst

> **Status: Planned** — Not yet implemented. See [#372](https://github.com/ryemyster/ShaleYeah/issues/372).

## Planned topology

```
Orchestrator / Caller
        │
        ▼
┌──────────────────────────┐
│ @shaleyeah/title-analyst │  Tier 2 — ReAct loop + governance
│ (port 4010)              │
└────────────┬─────────────┘
             │ MCP/HTTP
             ▼
┌────────────────────────┐
│ @shaleyeah/server-     │  Tier 1 — stateless tool server
│ title (port 3010)      │
└────────────────────────┘
```

## Planned tools

| Tool | Type | Model | requiresHumanApproval | Description |
|------|------|-------|-----------------------|-------------|
| `title-analyst.ownership_search` | query | standard-analysis | No | Mineral ownership chain of title |
| `title-analyst.lease_burdens` | query | standard-analysis | No | Royalty, ORRI, and other burden summary |
| `title-analyst.curative_needs` | query | deep-reasoning | No | Title defects requiring curative action |
| `title-analyst.title_opinion` | command | deep-reasoning | **Yes** | Draft title opinion document |

## Note

`title_opinion` carries legal weight and requires human approval before it is treated as final.
