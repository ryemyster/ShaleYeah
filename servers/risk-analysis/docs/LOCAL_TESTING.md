# Local Testing — @shaleyeah/server-risk-analysis

## Quick start

```bash
cd servers/risk-analysis
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing

```bash
# Terminal 1
PORT=3005 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2
cd agents/risk-analyst
RISK_ANALYSIS_MCP_URL=http://localhost:3005 npx tsx tests/mcp-client.test.ts
```

## Anti-stub test

```bash
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
# Expect: authentication error
```

## Monte Carlo determinism note

Monte Carlo results are intentionally random — each run produces a different distribution. Tests should check P50 is within a reasonable range, not an exact value.

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3005` | Server not started in HTTP mode | `PORT=3005 pnpm start` |
| Schema validation error | LLM returned unexpected shape | Check `RiskProfileSchema` in sdk/src/contracts.ts |
| Tests fail to import | Build needed | `pnpm build` first |
