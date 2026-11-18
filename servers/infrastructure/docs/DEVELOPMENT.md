# Development — @shaleyeah/server-infrastructure

## Setup

```bash
cd servers/infrastructure
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-infrastructure
```

## LLM wiring checklist

- [ ] `callLLM()` called with wellCount, productionRate, location in prompt
- [ ] Fallback: `deriveDefaultInfrastructureInterpretation(wellCount, productionRate, location)` exported
- [ ] Anti-stub test: `ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts`

## Key constraints

- No `Math.random()` in fallback functions
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- Governance (HITL, audit) lives in the `infrastructure-planner` agent, not here

## Linting

```bash
cd servers/infrastructure && npx biome check src/
```
