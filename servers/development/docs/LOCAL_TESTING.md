# Local Testing — @shaleyeah/server-development

## Quick start

```bash
cd servers/development
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing

```bash
# Terminal 1
PORT=3011 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2
cd agents/development-planner
DEVELOPMENT_MCP_URL=http://localhost:3011 npx tsx tests/mcp-client.test.ts
```

## Anti-stub test

```bash
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3011` | Server not started in HTTP mode | `PORT=3011 pnpm start` |
| Fallback returns unexpected risk | Budget/wellCount ratio off | Check `deriveDefaultDevelopmentOutlook()` logic |
| Tests fail to import | Build needed | `pnpm build` first |
