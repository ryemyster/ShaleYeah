# Local Testing — @shaleyeah/server-decision

## Quick start

```bash
cd servers/decision
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing

```bash
# Terminal 1
PORT=3013 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2
cd agents/investment-chair
DECISION_MCP_URL=http://localhost:3013 npx tsx tests/mcp-client.test.ts
```

## Anti-stub test

```bash
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3013` | Server not started in HTTP mode | `PORT=3013 pnpm start` |
| `DecisionSchema` parse error | LLM returned unexpected shape | Check prompt instructions in `src/index.ts` |
| Tests fail to import | Build needed | `pnpm build` first |
