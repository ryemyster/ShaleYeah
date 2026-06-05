# Development — @shaleyeah/infrastructure-planner

> **Status: Planned** — Not yet implemented. See [#375](https://github.com/ryemyster/ShaleYeah/issues/375).

## Implementation checklist

1. Write failing tests — copy `agents/geologist/tests/`, rename `infrastructurePlanner`/`infrastructure`, port `3012`
2. Create `src/agent/index.ts` from `.claude/rules/agent-template.md`
3. Create `src/agent/infrastructure-client.ts` — copy `geowiz-client.ts`, rename to `callInfrastructureTool`
4. Run tests until green; uncomment export; run `/pre-commit`

## Notes

- Env var: `INFRASTRUCTURE_MCP_URL`
- `infrastructure_schedule`: `modelRequirement: "deep-reasoning"`
