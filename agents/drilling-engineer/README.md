# @shaleyeah/drilling-engineer

> **Status: Stub** — implementation tracked in [#374](https://github.com/ryemyster/ShaleYeah/issues/374). Reference implementation: `agents/geologist/`.

The drilling engineer agent designs wellbore programs, selects BHA configurations, estimates AFE costs, and identifies drilling hazards. It pairs with the **drilling** Tier 1 MCP server (port 3003).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-drilling` | 3003 |
| Tier 2 (agent) | `@shaleyeah/drilling-engineer` | 4003 |

## Quick start (once implemented)

```bash
# Terminal 1 — Tier 1 server
cd servers/drilling && PORT=3003 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/drilling-engineer
ANTHROPIC_API_KEY=sk-ant-... DRILLING_MCP_URL=http://localhost:3003 pnpm test
```

## Implementing this agent

See `.claude/rules/agent-template.md` for the full copy-paste template. The geologist agent (`agents/geologist/src/agent/index.ts`) is the reference — copy it, rename `geologist` → `drillingEngineer` and `geowiz` → `drilling`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
