# Deployment

Deploy the Research Analyst as a Python ADK app from `agents/research-analyst`. Deploy `servers/research` separately as the MCP backend.

## Required Runtime Pieces

- Python 3.11 through 3.13.
- ADK dependencies from `pyproject.toml`.
- Network access from the agent runtime to the Research MCP backend.
- Model-provider credentials supplied by the runtime environment.
- Approved source or subscription credentials supplied outside the repository when required.

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `RESEARCH_MCP_URL` | No | `http://localhost:3008` | Research MCP backend URL |
| `RESEARCH_ANALYST_ADK_MODEL` | No | `gemini-flash-latest` | ADK root-agent model |

## Deployment Targets

The package is portable. Valid targets include local ADK, a container, Cloud Run, GKE, Agent Runtime, Fly.io, or another Python-capable runtime.

Keep these units independent:

- The agent deploys from `agents/research-analyst`.
- The MCP backend deploys from `servers/research`.
- Shared contracts stay in the monorepo shared packages until extracted.

## Pre-Deploy Checks

```bash
cd agents/research-analyst
uv run pytest
uv run python -m py_compile app/agent.py app/research_mcp.py
```

For the backend:

```bash
cd servers/research
pnpm test
pnpm build
```
