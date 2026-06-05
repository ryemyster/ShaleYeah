# @shaleyeah/development-planner

> **Status: Stub** — implementation tracked in [#373](https://github.com/ryemyster/ShaleYeah/issues/373). Reference implementation: `agents/geologist/`.

The development planner agent designs field development plans — well locations, spacing, pad layouts, infill opportunities, and phased development schedules. It pairs with the **development** Tier 1 MCP server (port 3011).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-development` | 3011 |
| Tier 2 (agent) | `@shaleyeah/development-planner` | 4011 |

## Quick start (once implemented)

```bash
# Terminal 1 — Tier 1 server
cd servers/development && PORT=3011 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/development-planner
ANTHROPIC_API_KEY=sk-ant-... DEVELOPMENT_MCP_URL=http://localhost:3011 pnpm test
```

## Implementing this agent

See `.claude/rules/agent-template.md` for the full copy-paste template. The geologist agent (`agents/geologist/src/agent/index.ts`) is the reference — copy it, rename `geologist` → `developmentPlanner` and `geowiz` → `development`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
