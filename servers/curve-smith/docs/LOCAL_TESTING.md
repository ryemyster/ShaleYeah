# Local Testing — @shaleyeah/server-curve-smith

## Quick start

```bash
cd servers/curve-smith
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing

```bash
# Terminal 1
PORT=3004 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2
cd agents/reservoir-engineer
CURVE_SMITH_MCP_URL=http://localhost:3004 npx tsx tests/mcp-client.test.ts
```

## Anti-stub test

```bash
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
# Expect: authentication error
```

## Test the fallback path

```bash
# No API key — deterministic Arps math still returns results
npx tsx tests/server.test.ts
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3004` | Server not started in HTTP mode | `PORT=3004 pnpm start` |
| `Insufficient data points` | < 3 months of production | Provide at least 3 data points |
| Tests fail to import | Build needed | `pnpm build` first |
