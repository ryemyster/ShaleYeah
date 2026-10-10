# Deployment

Deploy the Development Planner as a Python ADK app from `agents/development-planner`. Deploy `servers/development` separately as the MCP backend.

## Required Runtime Pieces

- Python 3.11 through 3.13.
- ADK dependencies from `pyproject.toml`.
- Network access from the agent runtime to the Development MCP backend.
- Model-provider credentials supplied by the runtime environment.

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DEVELOPMENT_MCP_URL` | No | `http://localhost:3011` | Development MCP backend URL |
| `DEVELOPMENT_PLANNER_ADK_MODEL` | No | `gemini-flash-latest` | ADK root-agent model |

## Deployment Targets

The package is portable. Valid targets include local ADK, a container, Cloud Run, GKE, Agent Runtime, Fly.io, or another Python-capable runtime.

Keep these units independent:

- The agent deploys from `agents/development-planner`.
- The MCP backend deploys from `servers/development`.
- Shared contracts stay in the monorepo shared packages until extracted.

## Pre-Deploy Checks

```bash
cd agents/development-planner
uv run pytest
uv run python -m py_compile app/agent.py app/development_mcp.py
```

For the backend:

```bash
cd servers/development
pnpm test
pnpm build
```
