# Local Testing — @shaleyeah/title-analyst

> **Status: Planned** — Not yet implemented. See [#372](https://github.com/ryemyster/ShaleYeah/issues/372).

## Once implemented

```bash
cd servers/title && PORT=3010 pnpm start
# (new terminal)
cd agents/title-analyst
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```
