# Local Testing — @shaleyeah/server-qa

## Quick start

```bash
cd servers/qa-server
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing

```bash
# Terminal 1
PORT=3014 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2
cd agents/quality-assurance
QA_SERVER_MCP_URL=http://localhost:3014 npx tsx tests/mcp-client.test.ts
```

## Anti-stub test

```bash
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3014` | Server not started in HTTP mode | `PORT=3014 pnpm start` |
| Unexpected "WARNING" status | Threshold ≥ 0.99 triggers warning | Adjust `accuracyThreshold` in test |
| Tests fail to import | Build needed | `pnpm build` first |
