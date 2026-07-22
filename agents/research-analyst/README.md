# Research Analyst

The Research Analyst is the ADK agent for oil and gas market intelligence. It helps gather and synthesize evidence about basins, operators, commodities, regulations, technologies, source URLs, and competitive activity.

It does not approve acquisitions, bids, capital allocation, trades, securities disclosures, reserve/resource classifications, legal or regulatory conclusions, publication of confidential research, or sensitive memory promotion. Those decisions need qualified human review.

## What This Package Contains

| Path | Purpose |
|------|---------|
| `app/agent.py` | ADK root agent, instructions, architecture marker, and tool list |
| `app/research_mcp.py` | Python MCP client wrappers for `servers/research` |
| `tests/` | pytest coverage for package shape, MCP wrapper parity, and eval harness shape |
| `tests/eval/` | ADK eval dataset and metric config for control, edge, and boundary cases |
| `agents-cli-manifest.yaml` | package-local Agents CLI manifest |

`servers/research` is the TypeScript MCP backend. This agent package is Python/ADK; backend tool implementation work belongs in the server package.

## How It Works

The agent runs as a stand-alone specialist with progressive disclosure of its Research MCP tools. It decides whether the user needs:

- `conduct_market_research` for market, source, commodity, technology, policy, or regulatory research.
- `analyze_competition` for operator, competitor, strategy, performance, or regional competitive-landscape work.

The default MCP backend URL is `http://localhost:3008`. Set `RESEARCH_MCP_URL` to point at another compatible Research MCP server.

## Run Locally

```bash
cd agents/research-analyst
uv run pytest
```

To exercise the MCP path, start the backend separately:

```bash
cd servers/research
PORT=3008 pnpm start
```

Then run ADK or pytest commands from `agents/research-analyst`.

## Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `RESEARCH_MCP_URL` | No | `http://localhost:3008` | Research MCP backend URL |
| `RESEARCH_ANALYST_ADK_MODEL` | No | `gemini-flash-latest` | ADK model for the root agent |

Provider credentials are supplied by the ADK runtime or deployment environment. Do not check secrets or subscription credentials into this package.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
