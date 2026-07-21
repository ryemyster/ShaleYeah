# Deployment — Risk Analyst ADK Agent

The Risk Analyst agent deploys as an ADK/Python unit. The Risk Analysis MCP server deploys separately and may remain TypeScript/pnpm.

## Required Pairing

| Unit | Path | Runtime |
|------|------|---------|
| Risk Analyst agent | `agents/risk-analyst` | ADK/Python |
| Risk Analysis MCP backend | `servers/risk-analysis` | TypeScript/pnpm MCP server |

Set `RISK_ANALYSIS_MCP_URL` in the Risk Analyst runtime to the reachable Risk Analysis MCP endpoint.

## Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `RISK_ANALYSIS_MCP_URL` | No | `http://localhost:3005` | Risk Analysis-compatible MCP backend URL |
| `RISK_ANALYST_ADK_MODEL` | No | `gemini-flash-latest` | ADK model id for local runs |

Provider credentials depend on the selected ADK model and deployment target.

## Local Production Smoke

```bash
cd agents/risk-analyst
uv run pytest
uv run python -m py_compile app/agent.py app/risk_analysis_mcp.py
agents-cli info
```

With Risk Analysis running:

```bash
RISK_ANALYSIS_MCP_URL=http://localhost:3005 agents-cli run \
  "Assess investment risk for a project with moderate risk profile"
```

## Cleanup Rule

Do not add deployment scripts that require npm/pnpm inside `agents/risk-analyst`. If deployment needs TypeScript, it belongs in `servers/risk-analysis`, `sdk`, `orchestrator`, or shared workspace automation.
