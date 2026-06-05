# Local Testing — @shaleyeah/drilling-engineer

> **Status: Planned** — Not yet implemented. See [#374](https://github.com/ryemyster/ShaleYeah/issues/374).

## Once implemented

```bash
# Terminal 1 — Tier 1 server
cd servers/drilling && PORT=3003 pnpm start

# Terminal 2 — tests
cd agents/drilling-engineer
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```

Follow `agents/geologist/docs/LOCAL_TESTING.md` as the reference pattern — replace ports and names.
