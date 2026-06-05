# Development — @shaleyeah/drilling-engineer

> **Status: Planned** — Not yet implemented. See [#374](https://github.com/ryemyster/ShaleYeah/issues/374).

## Implementation checklist

1. Write failing tests — copy `agents/geologist/tests/` and rename `geologist` → `drillingEngineer`, `geowiz` → `drilling`, port `3001` → `3003`
2. Create `src/agent/index.ts` from `.claude/rules/agent-template.md`
3. Create `src/agent/drilling-client.ts` — copy `geowiz-client.ts`, rename `callGeowizTool` → `callDrillingTool`
4. Run tests until green
5. Uncomment `export * from "./agent/index.js"` in `src/index.ts`
6. Run `/pre-commit`

## Key files to create

```
agents/drilling-engineer/
  src/agent/
    index.ts             ← drillingEngineerManifest + runDrillingEngineerTask
    drilling-client.ts   ← callDrillingTool
  tests/
    agent.test.ts
    mcp-client.test.ts
```

## Notes

- `hazard_assessment` tool should use `modelRequirement: "deep-reasoning"` in the manifest
- Destructive tools (permit submissions, rig bookings) should set `requiresHumanApproval: true`
