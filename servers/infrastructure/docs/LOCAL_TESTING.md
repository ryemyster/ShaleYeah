# Local Testing — @shaleyeah/server-infrastructure

## Quick start

```bash
cd servers/infrastructure
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing

```bash
# Terminal 1
PORT=3012 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2
cd agents/infrastructure-planner
INFRASTRUCTURE_MCP_URL=http://localhost:3012 npx tsx tests/mcp-client.test.ts
```

## Anti-stub test

```bash
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3012` | Server not started in HTTP mode | `PORT=3012 pnpm start` |
| Fallback risk level wrong | Location string not matching | Check `deriveDefaultInfrastructureInterpretation()` in `src/index.ts` |
| Tests fail to import | Build needed | `pnpm build` first |
