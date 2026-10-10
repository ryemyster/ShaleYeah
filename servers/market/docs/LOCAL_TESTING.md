# Local Testing — @shaleyeah/server-market

## Quick start (stub prices, no EIA key needed)

```bash
cd servers/market
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing with live prices

```bash
# Terminal 1
PORT=3007 ANTHROPIC_API_KEY=sk-... EIA_API_KEY=... pnpm start

# Terminal 2
cd agents/market-analyst
MARKET_MCP_URL=http://localhost:3007 npx tsx tests/mcp-client.test.ts
```

## Anti-stub test

```bash
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
```

## Testing stub vs live price paths

```bash
# Stub path (no EIA key)
npx tsx tests/server.test.ts

# Live path (requires EIA key)
EIA_API_KEY=your-key npx tsx tests/server.test.ts
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3007` | Server not started in HTTP mode | `PORT=3007 pnpm start` |
| Stale prices in tests | Cache not cleared | Call `clearEiaCache()` between tests |
| EIA rate limit | Too many fetches | Cache is in-process; restart server to clear |
| Tests fail to import | Build needed | `pnpm build` first |
