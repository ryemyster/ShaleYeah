# Local Testing - Market Analyst ADK Agent

Use package-local Python commands for the agent.

## Fast Verification

```bash
cd agents/market-analyst
uv run pytest
uv run python -m py_compile app/agent.py app/market_mcp.py
agents-cli info
```

## Live Backend Verification

Start the Market MCP server in another shell:

```bash
cd servers/market
PORT=3007 pnpm start
```

Then run the ADK agent:

```bash
cd agents/market-analyst
MARKET_MCP_URL=http://localhost:3007 agents-cli run \
  "Analyze gas market conditions for the Haynesville over a 1 year timeframe"
```

## Eval Verification

```bash
cd agents/market-analyst
agents-cli eval run
```

If credentials are unavailable, keep the pytest eval-shape tests passing so the dataset and config remain in place for CI or credentialed local runs.

## Common Failures

`MARKET_MCP_URL` connection errors mean the backend server is not running or the URL is wrong.

An npm, TypeScript, or `src/agent` file under `agents/market-analyst` means the agent package has regressed from the ADK migration boundary.
