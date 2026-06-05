# Architecture — @shaleyeah/reporter-agent

> **Status: Planned** — Not yet implemented. See [#368](https://github.com/ryemyster/ShaleYeah/issues/368).

## Planned topology

```
Orchestrator / Caller
        │
        ▼
┌──────────────────────────┐
│ @shaleyeah/reporter-agent│  Tier 2 — ReAct loop + governance
│ (port 4009)              │
└────────────┬─────────────┘
             │ MCP/HTTP
             ▼
┌────────────────────────┐
│ @shaleyeah/server-     │  Tier 1 — stateless tool server
│ reporter (port 3009)   │
└────────────────────────┘
```

## Planned tools

| Tool | Type | Model | requiresHumanApproval | Description |
|------|------|-------|-----------------------|-------------|
| `reporter-agent.generate_summary` | query | standard-analysis | No | Executive summary from analysis inputs |
| `reporter-agent.build_well_deck` | command | standard-analysis | **Yes** | Assemble well investment deck |
| `reporter-agent.export_report` | command | deterministic | **Yes** | Write formatted report to disk |
| `reporter-agent.format_table` | query | small-fast | No | Format tabular data for output |

## Note on destructive tools

`build_well_deck` and `export_report` write files — they are `destructive: true` and require human approval before execution.
