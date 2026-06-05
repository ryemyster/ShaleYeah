# Development — @shaleyeah/server-title

## Setup

```bash
cd servers/title
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/server.test.ts
pnpm turbo test --filter=@shaleyeah/server-title
```

## LLM wiring checklist

- [ ] `callLLM()` called with legal description, county, chainAge in prompt
- [ ] Zod schema validates `ownershipPercentage`, `riskLevel`, `encumbrances`, `notes`
- [ ] Fallback: `deriveDefaultTitleFindings(description, county, chainAge)` exported
- [ ] Anti-stub test: `ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts`

## Key constraints

- `riskLevel` must be `"low" | "medium" | "high"` — no other values
- `ownershipPercentage` must be a number 0–100
- No `Math.random()` in fallback functions
- No `@anthropic-ai/sdk` import — only `callLLM()` from `@shaleyeah/sdk`
- Governance (HITL, audit) lives in the `title-analyst` agent, not here

## Linting

```bash
cd servers/title && npx biome check src/
```
