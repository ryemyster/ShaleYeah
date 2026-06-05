# Local Testing — @shaleyeah/infrastructure-planner

> **Status: Planned** — Not yet implemented. See [#375](https://github.com/ryemyster/ShaleYeah/issues/375).

## Once implemented

```bash
cd servers/infrastructure && PORT=3012 pnpm start
# (new terminal)
cd agents/infrastructure-planner
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```
