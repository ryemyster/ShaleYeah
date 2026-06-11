# @shaleyeah/research-analyst

O&G market intelligence agent. Pairs with the **research** Tier 1 MCP server to deliver competitive landscape analysis, price forecasting, and evidence-backed recommendations.

Implemented in [#369](https://github.com/ryemyster/ShaleYeah/issues/369). Reference implementation: `agents/geologist/`.

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-research` | 3008 |
| Tier 2 (agent) | `@shaleyeah/research-analyst` | 4008 |

## Quick start

```bash
# Terminal 1 — Tier 1 server
cd servers/research && PORT=3008 pnpm start

# Terminal 2 — run a task
cd agents/research-analyst
ANTHROPIC_API_KEY=sk-ant-... RESEARCH_MCP_URL=http://localhost:3008 \
  npx tsx src/agent/index.ts "Research Permian Basin competitive landscape"
```

## Tools

| Tool | Description |
|------|-------------|
| `research-analyst.conduct_market_research` | Web intelligence, trend analysis, price forecasts, LLM synthesis |
| `research-analyst.analyze_competition` | Competitor profiles, threat classification, strategic benchmarking |

## Tests

```bash
pnpm test   # 47 tests (13 mcp-client + 34 agent contract)
```

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
