# @shaleyeah/research-analyst

> **Status: Stub** — implementation tracked in [#369](https://github.com/ryemyster/ShaleYeah/issues/369). Reference implementation: `agents/geologist/`.

The research analyst agent searches technical literature, operator activity reports, permit databases, and competitor filings to build intelligence packages. It pairs with the **research** Tier 1 MCP server (port 3008).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-research` | 3008 |
| Tier 2 (agent) | `@shaleyeah/research-analyst` | 4008 |

## Quick start (once implemented)

```bash
# Terminal 1 — Tier 1 server
cd servers/research && PORT=3008 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/research-analyst
ANTHROPIC_API_KEY=sk-ant-... RESEARCH_MCP_URL=http://localhost:3008 pnpm test
```

## Implementing this agent

See `.claude/rules/agent-template.md` for the full copy-paste template. The geologist agent (`agents/geologist/src/agent/index.ts`) is the reference — copy it, rename `geologist` → `researchAnalyst` and `geowiz` → `research`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
