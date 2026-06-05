# Local Testing — @shaleyeah/market-analyst

> **Status: Planned** — Not yet implemented. See [#371](https://github.com/ryemyster/ShaleYeah/issues/371).

## Once implemented

```bash
cd servers/market && PORT=3007 pnpm start
# (new terminal)
cd agents/market-analyst
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```
