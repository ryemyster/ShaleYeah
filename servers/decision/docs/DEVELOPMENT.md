# Development — @shaleyeah/server-decision

## Setup

```bash
cd servers/decision
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-decision
```

## LLM wiring checklist

- [ ] All three tools call `callLLM()` for synthesis
- [ ] `make_investment_decision` validates output against `DecisionSchema` from `@shaleyeah/sdk`
- [ ] Fallbacks: `calculateRecommendedBid()` and `countDomainsPresent()` exported
- [ ] Anti-stub test: `ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts`

## DecisionSchema usage

```typescript
import { DecisionSchema } from "@shaleyeah/sdk";
const parsed = DecisionSchema.parse(JSON.parse(llmResponse));
```

## Key constraints

- No `Math.random()` in fallback functions
- `calculateRecommendedBid()` must remain deterministic — used in anti-stub test
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- Governance (HITL, audit) lives in the `investment-chair` agent, not here

## Linting

```bash
cd servers/decision && npx biome check src/
```
