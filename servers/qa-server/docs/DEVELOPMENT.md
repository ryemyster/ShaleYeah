# Development — @shaleyeah/server-qa

## Setup

```bash
cd servers/qa-server
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-qa
```

## LLM wiring checklist

- [ ] Both tools call `callLLM()` for synthesis
- [ ] Fallback: `deriveDefaultQAResult(servers, accuracyThreshold)` exported
- [ ] Anti-stub test: `ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts`

## Key constraints

- No `Math.random()` in fallback functions
- `deriveDefaultQAResult()` must remain deterministic — threshold/server-count logic is load-bearing
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- Governance (HITL, audit) lives in the `quality-assurance` agent, not here

## Linting

```bash
cd servers/qa-server && npx biome check src/
```
