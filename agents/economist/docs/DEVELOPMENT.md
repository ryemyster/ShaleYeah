# Development — @shaleyeah/economist

> **Status: Planned** — Not yet implemented. See [#364](https://github.com/ryemyster/ShaleYeah/issues/364).

## Implementation checklist

Follow the exact sequence used for the geologist agent (the reference):

1. Write failing tests first (`tests/agent.test.ts`, `tests/mcp-client.test.ts`) — copy from `agents/geologist/tests/` and rename
2. Create `src/agent/index.ts` from `.claude/rules/agent-template.md` — fill in manifest, config, handlers
3. Create `src/agent/econobot-client.ts` — copy `agents/geologist/src/agent/geowiz-client.ts`, rename `callGeowizTool` → `callEconobotTool`
4. Run tests until green: `npx tsx tests/agent.test.ts && npx tsx tests/mcp-client.test.ts`
5. Update `src/index.ts` — uncomment `export * from "./agent/index.js"`
6. Run `/pre-commit` gate

## Key files to create

```
agents/economist/
  src/agent/
    index.ts              ← economist manifest + config + runEconomistTask
    econobot-client.ts    ← callEconobotTool
  tests/
    agent.test.ts         ← contract tests (copy + rename from geologist)
    mcp-client.test.ts    ← integration tests (copy + rename from geologist)
```

## Running tests

```bash
cd agents/economist
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```

## Reference

- Agent template: `.claude/rules/agent-template.md`
- Reference implementation: `agents/geologist/src/agent/index.ts`
- SDK contracts: `sdk/src/contracts.ts`
