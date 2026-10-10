# Local Testing — @shaleyeah/economist

> **Status: Planned** — Not yet implemented. See [#364](https://github.com/ryemyster/ShaleYeah/issues/364).

## Once implemented

Follow the same steps as `agents/geologist/docs/LOCAL_TESTING.md` — replace `geowiz`/`geologist`/`3001` with `econobot`/`economist`/`3002`.

```bash
# Terminal 1 — Tier 1 server
cd servers/econobot && PORT=3002 pnpm start

# Terminal 2 — tests
cd agents/economist
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```
