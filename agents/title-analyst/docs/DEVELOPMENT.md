# Development — @shaleyeah/title-analyst

> **Status: Planned** — Not yet implemented. See [#372](https://github.com/ryemyster/ShaleYeah/issues/372).

## Implementation checklist

1. Write failing tests — copy `agents/geologist/tests/`, rename `titleAnalyst`/`title`, port `3010`
2. Create `src/agent/index.ts` from `.claude/rules/agent-template.md`
3. Create `src/agent/title-client.ts` — copy `geowiz-client.ts`, rename to `callTitleTool`
4. Run tests until green; uncomment export; run `/pre-commit`

## Notes

- Env var: `TITLE_MCP_URL`
- `title_opinion`: `type: "command"`, `destructive: true`, `requiresHumanApproval: true`, `modelRequirement: "deep-reasoning"`
- `curative_needs`: `modelRequirement: "deep-reasoning"` (multi-document inference)
