# Market Analyst ADK Agent

**Mercatus Analyticus** — the ShaleYeah fleet's market intelligence analyst.

Tier 2 ADK/Python intelligence layer over the [`servers/market`](../../servers/market) Tier 1 MCP server. It analyzes commodity market conditions and competitive landscapes while deferring final bid or investment approval to human review.

## What It Does

Market Analyst turns market diligence questions into the right Market MCP tool call, sends structured commodity, region, and timeframe inputs to the backend, and explains pricing, supply-demand, and competitive context.

It exists so investment workflows can include market evidence in decisions without letting the agent approve bids, acquisitions, or investment actions.

## Project Boundary

This package is the Market Analyst ADK project inside the monorepo. ADK files live here (`agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`) and must not be added at repo root.

At runtime:

- ADK owns the agent shape, instructions, eval path, and backend-selection contract.
- Architecture mode is **Stand-alone Agent with Progressive Disclosure (Skills)**.
- The agent calls the Market MCP backend through package-local Python wrappers.
- `servers/market` is the independently runnable MCP backend.

## Run A Market Task

```bash
cd agents/market-analyst
agents-cli install
MARKET_MCP_URL=http://localhost:3007 agents-cli run \
  "Analyze current oil and gas market conditions for the Permian over a 1 year timeframe"
```

Start the Market MCP server separately when you want live backend execution:

```bash
cd servers/market
PORT=3007 pnpm start
```

## Tools

| Tool | What it does | Type | Final approval? |
|------|--------------|------|-----------------|
| `analyze_market_conditions` | Calls `analyze_market_conditions` for commodity pricing and supply-demand context | query | No |
| `competitive_market_analysis` | Calls `competitive_analysis` for operator and market landscape diligence | query | No |

## HITL Boundary

The agent must not present final bid or investment approval without human review.

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MARKET_MCP_URL` | No | `http://localhost:3007` | Market Tier 1 server URL |
| `MARKET_ANALYST_ADK_MODEL` | No | `gemini-flash-latest` | ADK model id for local runs |

## Build, Test, And Use

Run these from `agents/market-analyst`.

| Task | Command |
|------|---------|
| Install dependencies | `uv sync --extra eval` |
| Test package behavior | `uv run pytest` |
| Build/syntax check | `uv run python -m py_compile app/agent.py app/market_mcp.py` |
| Inspect ADK project | `agents-cli info` |
| Run a local task | `MARKET_MCP_URL=http://localhost:3007 agents-cli run "Analyze market conditions for the Permian"` |
| Run evals | `agents-cli eval run` |

## Key Files

| Path | Purpose |
|------|---------|
| [`app/agent.py`](app/agent.py) | Package-local ADK entrypoint and Market backend-selection tools |
| [`app/market_mcp.py`](app/market_mcp.py) | Python MCP client and ADK-side execution tools |
| [`agents-cli-manifest.yaml`](agents-cli-manifest.yaml) | agents-cli project marker for this package only |
| [`.agents-cli-spec.md`](.agents-cli-spec.md) | ADK reference-pair spec and boundaries |
| [`tests/test_adk_project_shape.py`](tests/test_adk_project_shape.py) | Regression tests for package-local ADK shape |
| [`tests/test_adk_mcp_execution_shape.py`](tests/test_adk_mcp_execution_shape.py) | Regression tests for ADK-owned Market MCP execution |
| [`tests/test_adk_eval_harness_shape.py`](tests/test_adk_eval_harness_shape.py) | Regression tests for eval dataset/config coverage |
