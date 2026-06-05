# Development — @shaleyeah/risk-analyst

> **Status: Planned** — Not yet implemented. See [#366](https://github.com/ryemyster/ShaleYeah/issues/366).

## Implementation checklist

1. Write failing tests — copy `agents/geologist/tests/`, rename `geologist` → `riskAnalyst`, `geowiz` → `riskAnalysis`, port `3001` → `3005`
2. Create `src/agent/index.ts` from `.claude/rules/agent-template.md`
3. Create `src/agent/risk-analysis-client.ts` — copy `geowiz-client.ts`, rename to `callRiskAnalysisTool`
4. Run tests until green
5. Uncomment export in `src/index.ts`
6. Run `/pre-commit`

## Key files to create

```
agents/risk-analyst/
  src/agent/
    index.ts                   ← riskAnalystManifest + runRiskAnalystTask
    risk-analysis-client.ts    ← callRiskAnalysisTool
  tests/
    agent.test.ts
    mcp-client.test.ts
```

## Notes

- Env var: `RISK_ANALYSIS_MCP_URL`
- `project_ranking` → `modelRequirement: "deep-reasoning"`
