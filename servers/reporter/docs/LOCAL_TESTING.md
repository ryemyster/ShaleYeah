# Local Testing — @shaleyeah/server-reporter

## Quick start

```bash
cd servers/reporter
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing

```bash
# Terminal 1
PORT=3009 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2
cd agents/reporter-agent
REPORTER_MCP_URL=http://localhost:3009 npx tsx tests/mcp-client.test.ts
```

## Anti-stub test

```bash
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
```

## End-to-end synthesis test

Supply mock outputs from all domain agents to exercise full synthesis:

```bash
# Provide all section data; verify report structure and narrative coherence
ANTHROPIC_API_KEY=sk-... npx tsx tests/server-e2e.test.ts
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3009` | Server not started in HTTP mode | `PORT=3009 pnpm start` |
| Empty report sections | Missing required args | Check `sections` object has all keys |
| Tests fail to import | Build needed | `pnpm build` first |
