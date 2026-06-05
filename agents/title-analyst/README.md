# @shaleyeah/title-analyst

> **Status: Stub** — implementation tracked in [#372](https://github.com/ryemyster/ShaleYeah/issues/372). Reference implementation: `agents/geologist/`.

The title analyst agent researches mineral ownership, chain of title, lease burdens, and encumbrances to produce title opinions and flag curative needs. It pairs with the **title** Tier 1 MCP server (port 3010).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-title` | 3010 |
| Tier 2 (agent) | `@shaleyeah/title-analyst` | 4010 |

## Quick start (once implemented)

```bash
# Terminal 1 — Tier 1 server
cd servers/title && PORT=3010 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/title-analyst
ANTHROPIC_API_KEY=sk-ant-... TITLE_MCP_URL=http://localhost:3010 pnpm test
```

## Implementing this agent

See `.claude/rules/agent-template.md` for the full copy-paste template. The geologist agent (`agents/geologist/src/agent/index.ts`) is the reference — copy it, rename `geologist` → `titleAnalyst` and `geowiz` → `title`.

> **Note:** Title opinions carry legal weight. Tools that generate opinions should set `requiresHumanApproval: true`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
