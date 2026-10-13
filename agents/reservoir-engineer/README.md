# @shaleyeah/reservoir-engineer

The current TypeScript runtime delegates tools to Curve Smith. Its full employee
workflow is tracked in [#681](https://github.com/ryemyster/ShaleYeah/issues/681),
after the backend repair in [#712](https://github.com/ryemyster/ShaleYeah/issues/712).

The reservoir engineer agent characterizes reservoirs, builds production forecasts, runs decline curve analysis, and estimates ultimate recoveries. It pairs with the **curve-smith** Tier 1 MCP server (port 3004).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-curve-smith` | 3004 |
| Tier 2 (agent) | `@shaleyeah/reservoir-engineer` | 4004 |

## Package checks

```bash
cd agents/reservoir-engineer
pnpm build
pnpm test
```

## MCP connection

Configure Curve Smith's identity, scopes and audit sink using the
[HTTP access guide](../../sdk/docs/http-access.md); `PORT` alone does not enroll
an HTTP server. Set `CURVE_SMITH_MCP_URL` to the configured `/mcp` endpoint and
`CURVE_SMITH_MCP_ACCESS_TOKEN_FILE` to its dedicated owner-readable credential
file (mode `0600`, separate from the model key). Historical bare local URLs are
normalized to `/mcp`.

Each call uses the pinned stateless protocol, a fresh bounded tool catalog,
a 30-second default deadline (maximum 120 seconds) and a 1 MiB response limit.
Redirects are denied. Genuine tool errors and failures after command dispatch
stop automatic retry; inspect the outcome before repeating a command. Transport
compatibility does not qualify professional recommendations, employee context
or revision-bound human review; those remain assigned to the role issue.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
