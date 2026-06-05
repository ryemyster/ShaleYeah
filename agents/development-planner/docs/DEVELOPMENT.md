# Development — @shaleyeah/development-planner

> **Status: Planned** — Not yet implemented. See [#373](https://github.com/ryemyster/ShaleYeah/issues/373).

## Implementation checklist

1. Write failing tests — copy `agents/geologist/tests/`, rename `developmentPlanner`/`development`, port `3011`
2. Create `src/agent/index.ts` from `.claude/rules/agent-template.md`
3. Create `src/agent/development-client.ts` — copy `geowiz-client.ts`, rename to `callDevelopmentTool`
4. Run tests until green; uncomment export; run `/pre-commit`

## Notes

- Env var: `DEVELOPMENT_MCP_URL`
- `development_schedule`: `modelRequirement: "deep-reasoning"`
