# Development — @shaleyeah/server-curve-smith

## Setup

```bash
cd servers/curve-smith
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-curve-smith
```

## TDD workflow

1. Write a failing test in `tests/server.test.ts` using MCP tool call
2. Add/modify tool in `src/index.ts` `tools:` array
3. Implement handler → call local math in `src/tools/decline-curve-analysis.ts` → `callLLM()` for interpretation → fallback
4. Confirm anti-stub test catches auth error

## LLM wiring checklist

- [ ] Handler calls local math first (deterministic), then `callLLM()` for interpretation
- [ ] Fallback: return raw math result without LLM framing (no `Math.random()`)
- [ ] Anti-stub test: `ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts`

## Key constraints

- All curve fitting math in `src/tools/decline-curve-analysis.ts` — no LLM inside
- No `Math.random()` anywhere — Arps math is deterministic
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- Governance (HITL, audit) lives in the `reservoir-engineer` agent, not here

## Linting

```bash
cd servers/curve-smith && npx biome check src/
```
