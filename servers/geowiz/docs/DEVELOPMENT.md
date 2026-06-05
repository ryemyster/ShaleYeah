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

All new tools follow test-first. The pattern:

1. Write a failing test in `tests/server.test.ts` that calls the tool via MCP
2. Add the tool to `src/index.ts` in the `tools:` array using `ServerFactory.createAnalysisTool()`
3. Implement the handler + LLM synthesis function + deterministic fallback
4. Confirm tests pass, then run the anti-stub test

## LLM wiring checklist

Every tool that calls `callLLM()` needs:

- [ ] `synthesize<Domain>WithLLM(input)` — calls `callLLM()` from `@shaleyeah/sdk`, returns typed result
- [ ] `deriveDefault<Domain>()` — rule-based fallback, deterministic, no `Math.random()`
- [ ] Handler wraps with try/catch and falls back on any error
- [ ] `tests/server-anti-stub.test.ts` entry — proves `messages.create` is actually called (use a fake API key to get an auth error; no auth error = LLM was never wired)

## Adding a new tool

```typescript
// In src/index.ts, add to the tools: array:
ServerFactory.createAnalysisTool(
    "my_new_tool",
    "Description shown to agents",
    z.object({
        filePath: z.string(),
        // ...
    }),
    async (args) => {
        try {
            return await synthesizeMyToolWithLLM(args);
        } catch (_err) {
            return deriveDefaultMyTool(args);
        }
    },
),
```

## Key constraints

- No `Math.random()` in any fallback function — use domain constants
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- No governance logic (HITL, audit trail) — that lives in the `geologist` agent
- Dynamic imports for large format parsers — keep startup time fast
- Tools return structured objects, not strings — the agent layer synthesizes prose

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
