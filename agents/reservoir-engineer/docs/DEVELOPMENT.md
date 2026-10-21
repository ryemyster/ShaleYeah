# Development — @shaleyeah/reservoir-engineer

> **Status: Planned** — Not yet implemented. See [#365](https://github.com/ryemyster/ShaleYeah/issues/365).

## Implementation checklist

1. Write failing tests — copy `agents/geologist/tests/`, rename `geologist` → `reservoirEngineer`, `geowiz` → `curveSmith`, port `3001` → `3004`
2. Create `src/agent/index.ts` from `.claude/rules/agent-template.md`
3. Create `src/agent/curve-smith-client.ts` — copy `geowiz-client.ts`, rename to `callCurveSmithTool`
4. Run tests until green
5. Uncomment export in `src/index.ts`
6. Run `/pre-commit`

## Key files to create

```
agents/reservoir-engineer/
  src/agent/
    index.ts                ← reservoirEngineerManifest + runReservoirEngineerTask
    curve-smith-client.ts   ← callCurveSmithTool
  tests/
    agent.test.ts
    mcp-client.test.ts
```

## Notes

- `material_balance` tool should use `modelRequirement: "deep-reasoning"` in the manifest
- Env var: `CURVE_SMITH_MCP_URL`
