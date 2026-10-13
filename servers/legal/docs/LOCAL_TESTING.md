# Local Testing — @shaleyeah/server-legal

## Quick start

```bash
cd servers/legal
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing

```bash
# Terminal 1
PORT=3006 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2
cd agents/legal-analyst
LEGAL_MCP_URL=http://localhost:3006 npx tsx tests/mcp-client.test.ts
```

## Anti-stub test

```bash
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3006` | Server not started in HTTP mode | `PORT=3006 pnpm start` |
| Tests fail to import | Build needed | `pnpm build` first |
