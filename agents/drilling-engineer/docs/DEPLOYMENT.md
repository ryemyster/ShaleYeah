# Deployment — Drilling Engineer ADK Agent

The Drilling Engineer agent is a package-local ADK/Python project. It should remain deployable independently from the Drilling MCP backend and from the optional orchestrator.

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DRILLING_MCP_URL` | No | `http://localhost:3003` | Drilling-compatible MCP backend URL |
| `DRILLING_ENGINEER_ADK_MODEL` | No | `gemini-flash-latest` | ADK model id |

## Deployment Boundary

- Agent package: `agents/drilling-engineer`
- Backend MCP server: `servers/drilling`
- Shared contracts: `sdk`
- Optional control plane: `orchestrator`

Do not hardcode a single deployment target into this package. The ADK app should remain portable across local execution, containerized runs, Cloud Run, GKE, Agent Runtime, or another compatible runtime.

## Pre-Deployment Checks

```bash
cd agents/drilling-engineer
uv run pytest
uv run python -m py_compile app/agent.py app/drilling_mcp.py
agents-cli info
```

Run `agents-cli eval run` when provider credentials and eval runtime are configured.
