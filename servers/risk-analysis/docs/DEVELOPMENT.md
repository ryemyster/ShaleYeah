# Development — @shaleyeah/server-risk-analysis

## Setup

```bash
cd servers/risk-analysis
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-risk-analysis
```

## LLM wiring checklist

- [ ] `callLLM()` called with multi-domain risk prompt
- [ ] Response validated against `RiskProfileSchema` from `@shaleyeah/sdk`
- [ ] Fallback: deterministic risk classification by `location` + `projectType`
- [ ] Anti-stub test: `ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts`

## Monte Carlo constraints

- `sampleUniform()`, `sampleTriangular()`, `sampleNormal()` are the **only** permitted uses of randomness
- Do NOT add `Math.random()` calls anywhere else in the codebase
- These functions are named explicitly to signal they are intentional samplers, not stubs

## Key constraints

- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- Governance (HITL, audit) lives in the `risk-analyst` agent, not here
- Schema validation (`RiskProfileSchema`, `EconomicsSchema`) must pass before returning result

## Linting

```bash
cd servers/risk-analysis && npx biome check src/
```
