# Local Testing — @shaleyeah/legal-analyst

> **Status: Planned** — Not yet implemented. See [#370](https://github.com/ryemyster/ShaleYeah/issues/370).

## Once implemented

```bash
cd servers/legal && PORT=3006 pnpm start
# (new terminal)
cd agents/legal-analyst
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```

Follow `agents/geologist/docs/LOCAL_TESTING.md` as the reference — replace ports and names.
