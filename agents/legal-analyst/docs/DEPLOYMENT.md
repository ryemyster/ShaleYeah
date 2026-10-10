# Deployment - Legal Analyst ADK Agent

Legal Analyst deploys as an ADK/Python agent package paired with the Legal MCP backend.

## Required Runtime Inputs

| Variable | Required | Default |
|----------|----------|---------|
| `LEGAL_MCP_URL` | No | `http://localhost:3006` |
| `LEGAL_ANALYST_ADK_MODEL` | No | `gemini-flash-latest` |

Set `LEGAL_MCP_URL` to the deployed `servers/legal` endpoint for non-local deployments.

## Pre-Deployment Checks

```bash
cd agents/legal-analyst
uv run pytest
uv run python -m py_compile app/agent.py app/legal_mcp.py
agents-cli info
```

Run ADK evals when credentials are available:

```bash
agents-cli eval run
```

## Deployment Shape

The agent package is independently buildable and extractable. Do not rely on root-level pnpm builds for Legal Analyst deployment. The backend MCP server remains independently deployable from `servers/legal`.

## Smoke Test

With the backend reachable:

```bash
cd agents/legal-analyst
LEGAL_MCP_URL=https://legal-mcp.example.com agents-cli run \
  "Assess compliance requirements for a New Mexico production project with 18 assets"
```

The response should cite the Legal backend path and avoid unreviewed legal opinion, filing, signature, or approval authority.
