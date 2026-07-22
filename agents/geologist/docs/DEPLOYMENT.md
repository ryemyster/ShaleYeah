# Deployment — Geologist ADK Agent

The Geologist agent deploys as an ADK/Python unit. The Geowiz MCP server deploys separately and may remain TypeScript/pnpm.

## Required Pairing

| Unit | Path | Runtime |
|------|------|---------|
| Geologist agent | `agents/geologist` | ADK/Python |
| Geowiz MCP backend | `servers/geowiz` | TypeScript/pnpm MCP server |

Set `GEOWIZ_MCP_URL` in the Geologist runtime to the reachable Geowiz MCP endpoint.

## Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GEOWIZ_MCP_URL` | No | `http://localhost:3001` | Geowiz-compatible MCP backend URL |
| `GEOLOGIST_ADK_MODEL` | No | `gemini-flash-latest` | ADK model id for local runs |

Provider credentials depend on the selected ADK model and deployment target.

## Local Production Smoke

```bash
cd agents/geologist
uv run pytest
uv run python -m py_compile app/agent.py app/geowiz_mcp.py
agents-cli info
```

With Geowiz running:

```bash
GEOWIZ_MCP_URL=http://localhost:3001 agents-cli run \
  "Use process_geowiz_well_logs to inspect sample.las"
```

## Scaling Boundary

Geowiz is stateless tool infrastructure and can scale horizontally behind a load balancer. The Geologist agent should be scaled as an ADK runtime unit and configured with the same Geowiz backend URL.

## Cleanup Rule

Do not add deployment scripts that require npm/pnpm inside `agents/geologist`. If deployment needs TypeScript, it belongs in `servers/geowiz`, `sdk`, `orchestrator`, or shared workspace automation.
