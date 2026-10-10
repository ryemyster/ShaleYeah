# @shaleyeah/reservoir-engineer

> **Status: Stub** — implementation tracked in [#365](https://github.com/ryemyster/ShaleYeah/issues/365). Reference implementation: `agents/geologist/`.

The reservoir engineer agent characterizes reservoirs, builds production forecasts, runs decline curve analysis, and estimates ultimate recoveries. It pairs with the **curve-smith** Tier 1 MCP server (port 3004).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-curve-smith` | 3004 |
| Tier 2 (agent) | `@shaleyeah/reservoir-engineer` | 4004 |

## Quick start (once implemented)

```bash
# Terminal 1 — Tier 1 server
cd servers/curve-smith && PORT=3004 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/reservoir-engineer
ANTHROPIC_API_KEY=sk-ant-... CURVE_SMITH_MCP_URL=http://localhost:3004 pnpm test
```

## Implementing this agent

See `.claude/rules/agent-template.md` for the full copy-paste template. The geologist agent (`agents/geologist/src/agent/index.ts`) is the reference — copy it, rename `geologist` → `reservoirEngineer` and `geowiz` → `curveSmith`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
