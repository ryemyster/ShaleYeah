# Development — @shaleyeah/legal-analyst

> **Status: Planned** — Not yet implemented. See [#370](https://github.com/ryemyster/ShaleYeah/issues/370).

## Implementation checklist

1. Write failing tests — copy `agents/geologist/tests/`, rename to `legalAnalyst`/`legal`, port `3006`
2. Create `src/agent/index.ts` from `.claude/rules/agent-template.md`
3. Create `src/agent/legal-client.ts` — copy `geowiz-client.ts`, rename to `callLegalTool`
4. Run tests until green; uncomment export; run `/pre-commit`

## Key notes

- `redline_contract`: set `type: "command"`, `destructive: true`, `requiresHumanApproval: true`
- `contract_review` and `redline_contract`: use `modelRequirement: "deep-reasoning"`
- Env var: `LEGAL_MCP_URL`
