# Development — @shaleyeah/reporter-agent

> **Status: Planned** — Not yet implemented. See [#368](https://github.com/ryemyster/ShaleYeah/issues/368).

## Implementation checklist

1. Write failing tests — copy `agents/geologist/tests/`, rename `reporterAgent`/`reporter`, port `3009`
2. Create `src/agent/index.ts` from `.claude/rules/agent-template.md`
3. Create `src/agent/reporter-client.ts` — copy `geowiz-client.ts`, rename to `callReporterTool`
4. Run tests until green; uncomment export; run `/pre-commit`

## Notes

- Env var: `REPORTER_MCP_URL`
- `build_well_deck`, `export_report`: `destructive: true`, `requiresHumanApproval: true`, `type: "command"`
- `format_table`: `modelRequirement: "small-fast"`, `type: "query"`
- Callers of `runReporterAgentTask` **must** provide `onApprovalRequired` if any file-writing tools may be called
