# Development — @shaleyeah/server-econobot

## Setup

```bash
cd servers/econobot
pnpm install
pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-econobot
```

## TDD workflow

1. Write a failing test in `tests/server.test.ts` that calls the tool via MCP
2. Add the tool to `src/index.ts` in the `tools:` array using `ServerFactory.createAnalysisTool()`
3. Implement handler + `synthesize*WithLLM()` + deterministic fallback
4. Add anti-stub test entry to prove `callLLM()` is actually called

## LLM wiring checklist

- [ ] `synthesize<Domain>WithLLM(input)` — calls `callLLM()` from `@shaleyeah/sdk`
- [ ] `deriveDefault<Domain>()` — deterministic math, no `Math.random()`
- [ ] Handler wraps with try/catch and falls back on any error
- [ ] `EconomicsSchema` used to validate LLM output (from `@shaleyeah/sdk`)
- [ ] Anti-stub test: `ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts`

## Key constraints

- No `Math.random()` — use real DCF formulas in fallback
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- No governance logic (HITL, audit) — that lives in the `economist` agent
- Tools return structured JSON, not prose strings

## Adding a new financial tool

```typescript
ServerFactory.createAnalysisTool(
    "my_financial_tool",
    "Description",
    z.object({ cashFlows: z.array(z.number()) }),
    async (args) => {
        try {
            return await synthesizeWithLLM(args);
        } catch (_err) {
            return deriveDefault(args);
        }
    },
),
```

## Linting

```bash
cd servers/econobot && npx biome check src/
```
