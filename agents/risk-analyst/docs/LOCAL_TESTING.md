# Local Testing — @shaleyeah/risk-analyst

> **Status: Planned** — Not yet implemented. See [#366](https://github.com/ryemyster/ShaleYeah/issues/366).

## Once implemented

```bash
# Terminal 1 — Tier 1 server
cd servers/risk-analysis && PORT=3005 pnpm start

# Terminal 2 — tests
cd agents/risk-analyst
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```

Follow `agents/geologist/docs/LOCAL_TESTING.md` as the reference pattern.
