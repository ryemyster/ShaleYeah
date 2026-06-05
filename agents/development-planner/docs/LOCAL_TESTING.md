# Local Testing — @shaleyeah/development-planner

> **Status: Planned** — Not yet implemented. See [#373](https://github.com/ryemyster/ShaleYeah/issues/373).

## Once implemented

```bash
cd servers/development && PORT=3011 pnpm start
# (new terminal)
cd agents/development-planner
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```
