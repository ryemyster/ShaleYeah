# Development — @shaleyeah/market-analyst

> **Status: Planned** — Not yet implemented. See [#371](https://github.com/ryemyster/ShaleYeah/issues/371).

## Implementation checklist

1. Write failing tests — copy `agents/geologist/tests/`, rename `marketAnalyst`/`market`, port `3007`
2. Create `src/agent/index.ts` from `.claude/rules/agent-template.md`
3. Create `src/agent/market-client.ts` — copy `geowiz-client.ts`, rename to `callMarketTool`
4. Run tests until green; uncomment export; run `/pre-commit`

## Notes

- Env var: `MARKET_MCP_URL`
- Market data tools may eventually need external API keys — pass via `AgentRuntimeConfig.dataConnectors`
