# Architecture — @shaleyeah/investment-chair

> **Status: Planned** — Not yet implemented. See [#367](https://github.com/ryemyster/ShaleYeah/issues/367).

## Planned topology

```
Orchestrator / Caller
        │
        ▼
┌──────────────────────────────┐
│ @shaleyeah/investment-chair  │  Tier 2 — ReAct loop + governance
│ (port 4013)                  │  Uses deep-reasoning model by default
└────────────┬─────────────────┘
             │ MCP/HTTP
             ▼
┌────────────────────────┐
│ @shaleyeah/server-     │  Tier 1 — stateless tool server
│ decision (port 3013)   │
└────────────────────────┘

Investment chair also consumes outputs from the full agent fleet:
  geologist · economist · risk-analyst · legal-analyst · market-analyst
  title-analyst · drilling-engineer · reservoir-engineer · development-planner
  infrastructure-planner · research-analyst
```

## Planned tools

| Tool | Type | Model | requiresHumanApproval | Description |
|------|------|-------|-----------------------|-------------|
| `investment-chair.synthesize_package` | query | deep-reasoning | No | Synthesize full analysis into decision summary |
| `investment-chair.rank_opportunities` | query | deep-reasoning | No | Portfolio rank by risked value |
| `investment-chair.go_no_go` | command | deep-reasoning | **Yes** | Generate final investment recommendation |
| `investment-chair.sensitivity_check` | query | standard-analysis | No | Key assumption sensitivity on final decision |

## Note

`go_no_go` is the highest-stakes output in the fleet — always `requiresHumanApproval: true`. The agent generates the recommendation; a human makes the final call.
