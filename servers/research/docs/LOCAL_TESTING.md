# Local Testing — @shaleyeah/server-research

## Quick start

```bash
cd servers/research
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing

```bash
# Terminal 1
PORT=3008 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2
cd agents/research-analyst
RESEARCH_MCP_URL=http://localhost:3008 npx tsx tests/mcp-client.test.ts
```

## Anti-stub test

```bash
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3008` | Server not started in HTTP mode | `PORT=3008 pnpm start` |
| Fetch failures in tests | Network access | Mock `fetchUrl()` in unit tests |
| Tests fail to import | Build needed | `pnpm build` first |
