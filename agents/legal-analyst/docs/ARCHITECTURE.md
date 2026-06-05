# Architecture — @shaleyeah/legal-analyst

> **Status: Planned** — Not yet implemented. See [#370](https://github.com/ryemyster/ShaleYeah/issues/370).

## Planned topology

```
Orchestrator / Caller
        │
        ▼
┌──────────────────────────┐
│ @shaleyeah/legal-analyst │  Tier 2 — ReAct loop + governance
│ (port 4006)              │  LocalAgentRuntime: HITL · scope · audit
└────────────┬─────────────┘
             │ MCP/HTTP
             ▼
┌────────────────────────┐
│ @shaleyeah/server-     │  Tier 1 — stateless tool server
│ legal (port 3006)      │
└────────────────────────┘
```

## Planned tools

| Tool | Type | Model | requiresHumanApproval | Description |
|------|------|-------|-----------------------|-------------|
| `legal-analyst.lease_summary` | query | standard-analysis | No | Extract key lease terms |
| `legal-analyst.compliance_check` | query | standard-analysis | No | Flag regulatory requirements |
| `legal-analyst.contract_review` | query | deep-reasoning | No | Material risk identification |
| `legal-analyst.title_issues` | query | standard-analysis | No | Surface/mineral rights flags |
| `legal-analyst.redline_contract` | command | deep-reasoning | **Yes** | Propose contract edits |

## Arcade patterns

Legal analysis tools that modify documents require human approval before any redline is accepted. See `agents/geologist/docs/ARCHITECTURE.md` for the complete governance reference.
