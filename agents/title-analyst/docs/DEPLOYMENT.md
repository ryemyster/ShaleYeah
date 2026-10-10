# Deployment — Title Analyst ADK Agent

The Title Analyst agent deploys as an ADK/Python unit. The Title MCP server deploys separately and may remain TypeScript/pnpm.

## Required Pairing

| Unit | Path | Runtime |
|------|------|---------|
| Title Analyst agent | `agents/title-analyst` | ADK/Python |
| Title MCP backend | `servers/title` | TypeScript/pnpm MCP server |

Set `TITLE_MCP_URL` in the Title Analyst runtime to the reachable Title MCP endpoint.

## Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `TITLE_MCP_URL` | No | `http://localhost:3010` | Title-compatible MCP backend URL |
| `TITLE_ANALYST_ADK_MODEL` | No | `gemini-flash-latest` | ADK model id for local runs |

Provider credentials depend on the selected ADK model and deployment target.

## Local Production Smoke

```bash
cd agents/title-analyst
uv run pytest
uv run python -m py_compile app/agent.py app/title_mcp.py
agents-cli info
```

With Title running:

```bash
TITLE_MCP_URL=http://localhost:3010 agents-cli run \
  "Examine ownership for Section 12 in Reeves County, Texas"
```

## Cleanup Rule

Do not add deployment scripts that require npm/pnpm inside `agents/title-analyst`. If deployment needs TypeScript, it belongs in `servers/title`, `sdk`, `orchestrator`, or shared workspace automation.
