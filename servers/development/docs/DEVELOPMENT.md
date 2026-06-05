# Development — @shaleyeah/server-development

## Setup

```bash
cd servers/development
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-development
```

## LLM wiring checklist

- [ ] Both tools call `callLLM()` for synthesis
- [ ] Fallback: `deriveDefaultDevelopmentOutlook(wellCount, budget, risks)` exported
- [ ] Anti-stub test: `ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts`

## Key constraints

- No `Math.random()` in fallback functions
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- Governance (HITL, audit) lives in the `development-planner` agent, not here

## Linting

```bash
cd servers/development && npx biome check src/
```
