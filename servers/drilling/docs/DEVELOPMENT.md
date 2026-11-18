# Development — @shaleyeah/server-drilling

## Setup

```bash
cd servers/drilling
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-drilling
```

## TDD workflow

1. Write a failing test in `tests/server.test.ts` using MCP tool call
2. Add/modify tool in `src/index.ts` `tools:` array
3. Implement handler + `synthesize*WithLLM()` + fallback
4. Confirm anti-stub test catches auth error

## LLM wiring checklist

- [ ] `synthesizeDrillingAnalysisWithLLM()` calls `callLLM()` from `@shaleyeah/sdk`
- [ ] `deriveDefaultDrillingInterpretation()` is deterministic (no `Math.random()`)
- [ ] Handler wraps with try/catch, falls back on any error
- [ ] Server tests cover deterministic fallbacks without live credentials.

## Key constraints

- Cost estimates use deterministic formulas — depth × rate factor — never random
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- `deriveDefaultDrillingInterpretation()` and `synthesizeDrillingAnalysisWithLLM()` are exported (tests use them directly)
- Governance (HITL, audit) lives in the `drilling-engineer` agent, not here

## Linting

```bash
cd servers/drilling && npx biome check src/
```
