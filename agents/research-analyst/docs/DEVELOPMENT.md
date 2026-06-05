# Development — @shaleyeah/research-analyst

> **Status: Planned** — Not yet implemented. See [#369](https://github.com/ryemyster/ShaleYeah/issues/369).

## Implementation checklist

1. Write failing tests — copy `agents/geologist/tests/`, rename `researchAnalyst`/`research`, port `3008`
2. Create `src/agent/index.ts` from `.claude/rules/agent-template.md`
3. Create `src/agent/research-client.ts` — copy `geowiz-client.ts`, rename to `callResearchTool`
4. Run tests until green; uncomment export; run `/pre-commit`

## Notes

- Env var: `RESEARCH_MCP_URL`
- `permit_search` → `modelRequirement: "small-fast"` (lookup, not reasoning)
