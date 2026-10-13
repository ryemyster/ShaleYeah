# @shaleyeah/economist

The current TypeScript runtime delegates tools to Econobot. Its full employee
workflow is tracked in [#680](https://github.com/ryemyster/ShaleYeah/issues/680),
after the backend repair in [#711](https://github.com/ryemyster/ShaleYeah/issues/711).

The economist agent analyzes the financial viability of oil & gas projects — NPV, IRR, break-even prices, sensitivity tables, and capital budgeting decisions. It pairs with the **econobot** Tier 1 MCP server (port 3002).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-econobot` | 3002 |
| Tier 2 (agent) | `@shaleyeah/economist` | 4002 |

## Package checks

```bash
cd agents/economist
pnpm build
pnpm test
```

## MCP connection

Configure Econobot's identity, scopes and audit sink using the
[HTTP access guide](../../sdk/docs/http-access.md); `PORT` alone does not enroll
an HTTP server. Set `ECONOBOT_MCP_URL` to the configured `/mcp` endpoint and
`ECONOBOT_MCP_ACCESS_TOKEN_FILE` to its dedicated owner-readable credential
file (mode `0600`, separate from the model key). Historical bare local URLs are
normalized to `/mcp`.

Each call uses the pinned stateless protocol, a fresh bounded tool catalog,
a 30-second default deadline (maximum 120 seconds) and a 1 MiB response limit.
Redirects are denied. Genuine tool errors and failures after command dispatch
stop automatic retry; inspect the outcome before repeating a command. Transport
compatibility does not qualify professional recommendations, employee context
or revision-bound human review; those remain assigned to the role issue.

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
