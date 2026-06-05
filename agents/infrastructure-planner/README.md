# @shaleyeah/infrastructure-planner

> **Status: Stub** — implementation tracked in [#375](https://github.com/ryemyster/ShaleYeah/issues/375). Reference implementation: `agents/geologist/`.

The infrastructure planner agent sizes and routes pipelines, compressor stations, saltwater disposal systems, and surface facilities to support a development plan. It pairs with the **infrastructure** Tier 1 MCP server (port 3012).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-infrastructure` | 3012 |
| Tier 2 (agent) | `@shaleyeah/infrastructure-planner` | 4012 |

## Quick start (once implemented)

```bash
# Terminal 1 — Tier 1 server
cd servers/infrastructure && PORT=3012 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/infrastructure-planner
ANTHROPIC_API_KEY=sk-ant-... INFRASTRUCTURE_MCP_URL=http://localhost:3012 pnpm test
```

## Implementing this agent

See `.claude/rules/agent-template.md` for the full copy-paste template. The geologist agent (`agents/geologist/src/agent/index.ts`) is the reference — copy it, rename `geologist` → `infrastructurePlanner` and `geowiz` → `infrastructure`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
