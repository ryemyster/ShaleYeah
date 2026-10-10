# Development - Market Analyst ADK Agent

Market Analyst development happens inside this package as an ADK/Python project. Use package-local commands and keep root-level build changes out of agent work.

## Setup

```bash
cd agents/market-analyst
uv sync --extra eval --extra lint
agents-cli info
```

Start the backend only when a live MCP call is needed:

```bash
cd servers/market
PORT=3007 pnpm start
```

## Test Loop

Write or update tests before changing agent behavior:

```bash
cd agents/market-analyst
uv run pytest
uv run python -m py_compile app/agent.py app/market_mcp.py
agents-cli eval run
```

`agents-cli eval run` may require configured ADK credentials. The pytest suite always checks that the eval dataset and config exist and cover control, edge, capability-boundary, and tool-selection cases.

## Adding A Market Tool

1. Confirm the backend tool exists in `servers/market`.
2. Add a Python wrapper in `app/market_mcp.py`.
3. Register the wrapper in `app/agent.py`.
4. Add or update eval cases under `tests/eval/`.
5. Extend pytest coverage for project shape, wrapper parity, and eval shape.
6. Update README, package changelog, and root `CHANGELOG.md`.
7. Update documentation and eval coverage for the behavior change.

## Cleanup Rule

Agent behavior belongs in the ADK package. Server tool behavior belongs in the matching MCP server package.
