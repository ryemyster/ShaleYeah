# @shaleyeah/economist

> **Status: Tier 2 agent** — implemented from the `agents/geologist/` and `agents/quality-assurance/` runtime pattern.

The economist agent analyzes the financial viability of oil & gas projects — NPV, IRR, break-even prices, sensitivity tables, and capital budgeting decisions. It pairs with the **econobot** Tier 1 MCP server (port 3002).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-econobot` | 3002 |
| Tier 2 (agent) | `@shaleyeah/economist` | 4002 |

## Quick start

```bash
# Terminal 1 — Tier 1 server
cd servers/econobot && PORT=3002 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/economist
ANTHROPIC_API_KEY=sk-ant-... ECONOBOT_MCP_URL=http://localhost:3002 pnpm test
```

`ECONOBOT_MCP_URL` is the deployment-time URL for the paired econobot MCP server. The default local runtime config uses `mcpServers.econobot.url = "http://localhost:3002"`.

## Runtime

The agent exports `createEconomistRuntime()`, `createEconomistEndpoint()`, `runEconomistTask()`, and `callEconobotTool()`. Agent tools delegate to the Tier 1 `econobot` MCP server over HTTP:

- `economist.analyze_economics` -> `analyze_economics`
- `economist.calculate_dcf` -> `calculate_dcf`
- `economist.sensitivity_analysis` -> `sensitivity_analysis`

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
