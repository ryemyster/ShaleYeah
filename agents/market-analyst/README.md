# @shaleyeah/market-analyst

> **Status: Stub** — implementation tracked in [#371](https://github.com/ryemyster/ShaleYeah/issues/371). Reference implementation: `agents/geologist/`.

The market analyst agent tracks oil and gas prices, basis differentials, hedging opportunities, and market supply/demand signals. It pairs with the **market** Tier 1 MCP server (port 3007).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-market` | 3007 |
| Tier 2 (agent) | `@shaleyeah/market-analyst` | 4007 |

## Quick start (once implemented)

```bash
# Terminal 1 — Tier 1 server
cd servers/market && PORT=3007 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/market-analyst
ANTHROPIC_API_KEY=sk-ant-... MARKET_MCP_URL=http://localhost:3007 pnpm test
```

## Implementing this agent

See `.claude/rules/agent-template.md` for the full copy-paste template. The geologist agent (`agents/geologist/src/agent/index.ts`) is the reference — copy it, rename `geologist` → `marketAnalyst` and `geowiz` → `market`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
