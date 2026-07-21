# Deployment - Market Analyst ADK Agent

Market Analyst deploys as an ADK/Python agent package paired with the Market MCP backend.

## Required Runtime Inputs

| Variable | Required | Default |
|----------|----------|---------|
| `MARKET_MCP_URL` | No | `http://localhost:3007` |
| `MARKET_ANALYST_ADK_MODEL` | No | `gemini-flash-latest` |

Set `MARKET_MCP_URL` to the deployed `servers/market` endpoint for non-local deployments.

## Pre-Deployment Checks

```bash
cd agents/market-analyst
uv run pytest
uv run python -m py_compile app/agent.py app/market_mcp.py
agents-cli info
```

Run ADK evals when credentials are available:

```bash
agents-cli eval run
```

## Deployment Shape

The agent package is independently buildable and extractable. Do not rely on root-level pnpm builds for Market Analyst deployment. The backend MCP server remains independently deployable from `servers/market`.

## Smoke Test

With the backend reachable:

```bash
cd agents/market-analyst
MARKET_MCP_URL=https://market-mcp.example.com agents-cli run \
  "Compare Chevron and ExxonMobil in the Delaware Basin on production and costs"
```

The response should cite the Market backend path and avoid unreviewed final investment approval.
