# Local Testing — @shaleyeah/research-analyst

> **Status: Planned** — Not yet implemented. See [#369](https://github.com/ryemyster/ShaleYeah/issues/369).

## Once implemented

```bash
cd servers/research && PORT=3008 pnpm start
# (new terminal)
cd agents/research-analyst
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```
