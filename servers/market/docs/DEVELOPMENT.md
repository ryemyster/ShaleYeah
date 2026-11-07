# Development — @shaleyeah/server-market

## Setup

```bash
cd servers/market
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-market
```

## LLM wiring checklist

- [ ] `synthesizeMarketAnalysisWithLLM()` calls `callLLM()`
- [ ] `synthesizeCompetitorAnalysisWithLLM()` calls `callLLM()`
- [ ] Fallbacks: `deriveDefaultMarketInterpretation()`, `deriveDefaultCompetitorProfile()`
- [ ] `clearEiaCache()` exported for tests (reset between test runs)
- [ ] Anti-stub test: `ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts`

## EIA API testing

Tests should call `clearEiaCache()` before each test to prevent price data from leaking between tests:

```typescript
import { clearEiaCache } from "../src/index.js";
beforeEach(() => clearEiaCache());
```

## Key constraints

- No `Math.random()` in fallback functions
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- `EIA_API_KEY` is optional — tests must pass without it (stub prices are the fallback)
- Governance (HITL, audit) lives in the `market-analyst` agent, not here

## Linting

```bash
cd servers/market && npx biome check src/
```
