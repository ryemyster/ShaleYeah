# Development — @shaleyeah/server-research

## Setup

```bash
cd servers/research
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-research
```

## LLM wiring checklist

- [ ] `fetchUrl()` called first, then `callLLM()` with fetched content
- [ ] Fallbacks: `deriveDefaultResearchSummary()`, `deriveDefaultCompetitorEntry()`
- [ ] Anti-stub test: `ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts`

## Web fetch in tests

Tests should mock or stub `fetchUrl()` to avoid network calls. The function is in `src/tools/web-fetch.ts` and can be imported directly for mocking.

## Key constraints

- `web-fetch.ts` must remain pure — no LLM calls inside
- No `Math.random()` in fallback functions
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- Governance (HITL, audit) lives in the `research-analyst` agent, not here

## Linting

```bash
cd servers/research && npx biome check src/
```
