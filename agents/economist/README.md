# @shaleyeah/economist

> **Status: Stub** — implementation tracked in [#364](https://github.com/ryemyster/ShaleYeah/issues/364). Reference implementation: `agents/geologist/`.

The economist agent analyzes the financial viability of oil & gas projects — NPV, IRR, break-even prices, sensitivity tables, and capital budgeting decisions. It pairs with the **econobot** Tier 1 MCP server (port 3002).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-econobot` | 3002 |
| Tier 2 (agent) | `@shaleyeah/economist` | 4002 |

## Quick start (once implemented)

```bash
# Terminal 1 — Tier 1 server
cd servers/econobot && PORT=3002 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/economist
ANTHROPIC_API_KEY=sk-ant-... ECONOBOT_MCP_URL=http://localhost:3002 pnpm test
```

## Implementing this agent

See `.claude/rules/agent-template.md` for the full copy-paste template. The geologist agent (`agents/geologist/src/agent/index.ts`) is the reference — copy it, rename `geologist` → `economist` and `geowiz` → `econobot`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
