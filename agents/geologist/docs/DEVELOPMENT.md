# Development Guide — @shaleyeah/geologist

## Prerequisites

```bash
node >= 22
pnpm >= 9
```

## Setup

```bash
# From repo root
pnpm install
pnpm turbo build --filter @shaleyeah/geologist
```

## ADK package-local workflow

This directory is an ADK project. The repo root is not.

```bash
cd agents/geologist
agents-cli info
agents-cli install      # installs Python ADK dependencies when needed
agents-cli run "Assess the data quality of sample.las"
```

`app/agent.py` is the target authoring surface for Geologist reasoning, instructions, and ADK tools. `app/geowiz_mcp.py` owns the first ADK-side Geowiz MCP execution path for `assess_quality`.

`src/agent/` is a temporary adapter retained for existing TypeScript callers and remaining Geowiz tools until each path has an ADK replacement.

## TDD workflow

This package follows strict TDD: tests are written before implementation. All tests use Node's built-in `assert` — no jest, no vitest.

```bash
# Run all tests (no live server required)
cd agents/geologist && npx tsx tests/mcp-client.test.ts
cd agents/geologist && npx tsx tests/agent.test.ts

# Or via turbo
pnpm turbo test --filter @shaleyeah/geologist
```

## Test suites

| File | What it tests | Live server needed? |
|------|--------------|-------------------|
| `tests/adk-project-shape.test.ts` | Package-local ADK markers and root-boundary regression | No |
| `tests/adk-mcp-execution-shape.test.ts` | First ADK-owned Geowiz MCP execution boundary | No |
| `tests/agent.test.ts` | Manifest validation, runtime contract, HITL, model routing, evals, standalone boot | No (3 execute tests skip if geowiz is down) |
| `tests/mcp-client.test.ts` | MCP HTTP client, SDK error exports, HITL gate, `runGeologistTask` | No (integration tests skip if unreachable) |
| `sdk/tests/errors.test.ts` | `RetryableToolError` / `PermanentToolError` | No |

## Adding a new tool

1. Add the tool declaration to `geologistManifest.tools[]` in `src/agent/index.ts`
   — include `name`, `description`, `type`, `modelRequirement`, `requiredScopes`, `mcpServer: "geowiz"`, `inputSchema`
2. Add a handler to the `handlers` map: `"geologist.new_tool": ({ args, config }) => callGeowizTool(geowizUrl(config), "new_tool", args)`
3. Make sure the corresponding tool exists in `servers/geowiz/src/index.ts` (or open an issue against geowiz)
4. Add a test in `tests/mcp-client.test.ts` asserting the tool has `mcpServer: "geowiz"`
5. Run `pnpm turbo build` — the manifest Zod schema validates all required fields at construction time

## Changing HITL policy

The HITL gate is configured in `geologistConfig.hitl` in `src/agent/index.ts`:

```typescript
hitl: {
    approvalMode: "when-sensitive", // "never" | "when-sensitive" | "always"
    requireForDestructive: true,
    requireForMemoryPromotion: true,
}
```

To require approval for a specific tool regardless of global mode, set `requiresHumanApproval: true` on the tool manifest entry. This cannot be overridden by `approvalMode: "never"` — it's a hard gate.

## Changing model routing

`geologistConfig.modelRouting` maps capability labels to concrete models. No tool hardcodes a model name — they declare a capability requirement and the operator supplies the binding:

```typescript
modelRouting: {
    "standard-analysis": { provider: "anthropic", model: "claude-sonnet-4-6" },
    "deterministic":     { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    // ...
}
```

## Lint

```bash
cd agents/geologist && pnpm exec biome check --write .
```

## Type checking

```bash
cd agents/geologist && pnpm type-check
```

## Adding a custom audit logger (e.g. Supabase)

```typescript
import { createGeologistRuntime } from "@shaleyeah/geologist";

const runtime = createGeologistRuntime(config, {
    auditLogger: (entry) => supabase.from("audit_log").insert(entry),
});
```

The default logger writes JSON lines to stderr. Pass `() => {}` to disable.

---

## See also

- [README](../README.md) — quick start, tool table, commands
- [ARCHITECTURE.md](ARCHITECTURE.md) — topology, execution paths, Arcade patterns
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — five-component framework, plain-language explanation
- [INTEGRATION.md](INTEGRATION.md) — calling this agent from your code
- [DEPLOYMENT.md](DEPLOYMENT.md) — production deployment, Docker, Kong, BYOE model routing
- [LOCAL_TESTING.md](LOCAL_TESTING.md) — running both processes locally, HITL testing
