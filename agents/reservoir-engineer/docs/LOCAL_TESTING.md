# Local Testing — @shaleyeah/reservoir-engineer

> **Status: Planned** — Not yet implemented. See [#365](https://github.com/ryemyster/ShaleYeah/issues/365).

## Once implemented

```bash
# Terminal 1 — Tier 1 server
cd servers/curve-smith && PORT=3004 pnpm start

# Terminal 2 — tests
cd agents/reservoir-engineer
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```

Follow `agents/geologist/docs/LOCAL_TESTING.md` as the reference pattern.
