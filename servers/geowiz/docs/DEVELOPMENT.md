# Development — @shaleyeah/server-geowiz

## Setup

```bash
cd servers/geowiz
pnpm install
pnpm build
```

## Test commands

```bash
# Full test suite
npx tsx tests/server.test.ts
npx tsx tests/tools.test.ts

# Or via Turborepo from repo root
pnpm turbo test --filter=@shaleyeah/server-geowiz
```

## TDD workflow

1. Write an offline failing behavior test in `tests/` before changing source.
2. Add a typed MCP operation to the per-instance template. Keep credentials and
   trusted configuration out of tool arguments.
3. Implement the behavior and explicit failures. Use an injected SDK model runtime
   if the tool needs model synthesis; never substitute a vendor or fabricated answer.
4. Run package build/type/lint/tests and provider conformance. Delete displaced
   paths and update docs/changelog before a PR into develop.

[Provider qualification](../../../docs/model-providers.md) covers native SDK fixtures,
real protected transport controls and ADK role/HITL regressions. These fixtures
are not evidence of professional geological quality. Domain repairs stay in #671.

## Constraints

- Import maintained provider adapters through the shared TypeScript SDK.
- Enforce auth/scopes/ownership at the executing boundary; keep human confirmation
  distinct from backend authorization and professional acceptance.
- Do not put keys in prompts, files of findings, logs or tool discovery.
- Keep large format parsers dynamically loaded and results structured.
- Classify failures and preserve missing data. A missing provider is not a success.

## File structure

```
servers/geowiz/
  src/
    index.ts           ← server template, all tool definitions
    tools/             ← format-specific parsers (dynamically imported)
  tests/
    server.test.ts     ← MCP tool call integration tests
    tools.test.ts      ← unit tests for parsers in src/tools/
  docs/                ← this directory
  package.json
  tsconfig.json
```

## Linting

```bash
pnpm turbo lint --filter=@shaleyeah/server-geowiz
# or
cd servers/geowiz && npx biome check src/
```

---

## See also

- [README](../README.md) — quick start, Claude Desktop config, tool table
- [ARCHITECTURE.md](ARCHITECTURE.md) — tool inventory, data flow, LLM call locations
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — plain-language + technical lifecycle
- [INTEGRATION.md](INTEGRATION.md) — calling geowiz tools from an agent or MCP client
- [DEPLOYMENT.md](DEPLOYMENT.md) — stdio vs HTTP, Docker, Kong, production checklist
- [LOCAL_TESTING.md](LOCAL_TESTING.md) — running locally, testing tools directly
