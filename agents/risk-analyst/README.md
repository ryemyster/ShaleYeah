# @shaleyeah/risk-analyst

> **Status: Stub** — implementation tracked in [#366](https://github.com/ryemyster/ShaleYeah/issues/366). Reference implementation: `agents/geologist/`.

The risk analyst agent runs Monte Carlo simulations, builds risk matrices, computes probability-weighted outcomes, and ranks project risks. It pairs with the **risk-analysis** Tier 1 MCP server (port 3005).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-risk-analysis` | 3005 |
| Tier 2 (agent) | `@shaleyeah/risk-analyst` | 4005 |

## Quick start (once implemented)

```bash
# Terminal 1 — Tier 1 server
cd servers/risk-analysis && PORT=3005 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/risk-analyst
ANTHROPIC_API_KEY=sk-ant-... RISK_ANALYSIS_MCP_URL=http://localhost:3005 pnpm test
```

## Implementing this agent

See `.claude/rules/agent-template.md` for the full copy-paste template. The geologist agent (`agents/geologist/src/agent/index.ts`) is the reference — copy it, rename `geologist` → `riskAnalyst` and `geowiz` → `riskAnalysis`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
