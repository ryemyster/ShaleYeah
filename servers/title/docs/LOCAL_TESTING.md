# Local Testing — @shaleyeah/server-title

## Quick start

```bash
cd servers/title
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing

```bash
# Terminal 1
PORT=3010 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2
cd agents/title-analyst
TITLE_MCP_URL=http://localhost:3010 npx tsx tests/mcp-client.test.ts
```

## Anti-stub test

```bash
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3010` | Server not started in HTTP mode | `PORT=3010 pnpm start` |
| `riskLevel` validation fails | LLM returned unexpected value | Check Zod schema in `src/index.ts` |
| Tests fail to import | Build needed | `pnpm build` first |
