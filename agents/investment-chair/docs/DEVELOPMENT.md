# Development — @shaleyeah/investment-chair

> **Status: Planned** — Not yet implemented. See [#367](https://github.com/ryemyster/ShaleYeah/issues/367).

## Implementation checklist

1. Write failing tests — copy `agents/geologist/tests/`, rename `investmentChair`/`decision`, port `3013`
2. Create `src/agent/index.ts` from `.claude/rules/agent-template.md`
3. Create `src/agent/decision-client.ts` — copy `geowiz-client.ts`, rename to `callDecisionTool`
4. Run tests until green; uncomment export; run `/pre-commit`

## Key differences from other agents

- Default model routing: consider overriding `standard-analysis` default to `deep-reasoning` in `investmentChairConfig`
- `go_no_go`: `type: "command"`, `destructive: true`, `requiresHumanApproval: true`, `modelRequirement: "deep-reasoning"`
- All synthesis tools: `modelRequirement: "deep-reasoning"`
- Callers **must** provide `onApprovalRequired` — this agent will always trigger the HITL gate on final recommendations

## Notes

- Env var: `DECISION_MCP_URL`
- This is the last agent in the orchestration chain — it depends on outputs from 11 other agents
