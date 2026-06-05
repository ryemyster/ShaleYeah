# Development — @shaleyeah/server-legal

## Setup

```bash
cd servers/legal
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-legal
```

## LLM wiring checklist

- [ ] `callLLM()` called with jurisdiction + project type + lease terms prompt
- [ ] Fallback: `deriveDefaultRegulatoryRisk()` — deterministic, exported for tests
- [ ] Anti-stub test: `ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts`

## Key constraints

- No `Math.random()` in fallback functions
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- `deriveDefaultRegulatoryRisk()` must encode real regulatory patterns (not return same value always)
- Governance (HITL, audit) lives in the `legal-analyst` agent, not here

## Linting

```bash
cd servers/legal && npx biome check src/
```
