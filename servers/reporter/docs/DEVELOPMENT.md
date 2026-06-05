# Development — @shaleyeah/server-reporter

## Setup

```bash
cd servers/reporter
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-reporter
```

## LLM wiring checklist

- [ ] All three tools call `callLLM()` for synthesis
- [ ] Fallbacks exist for all three tools
- [ ] Anti-stub test: `ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts`

## Key constraints

- No `Math.random()` in fallback functions
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- Governance (HITL, audit) lives in the `reporter-agent`, not here

## Linting

```bash
cd servers/reporter && npx biome check src/
```
