# Local Testing — Risk Analyst ADK Agent + Risk Analysis

The Risk Analyst agent is ADK/Python. The Risk Analysis server is the TypeScript MCP backend it calls over HTTP.

## Verify The Agent Package

```bash
cd agents/risk-analyst
uv run pytest
uv run python -m py_compile app/agent.py app/risk_analysis_mcp.py
agents-cli info
```

`agents-cli info` should detect `agents/risk-analyst` as the project. It should not require or create ADK files at repo root.

## Run With A Live Risk Analysis Backend

Start the MCP server in one terminal:

```bash
cd servers/risk-analysis
PORT=3005 pnpm start
```

Run the ADK agent in another terminal:

```bash
cd agents/risk-analyst
agents-cli install
RISK_ANALYSIS_MCP_URL=http://localhost:3005 agents-cli run \
  "Assess investment risk for a Wolfcamp project"
```

## Run ADK Evals

```bash
cd agents/risk-analyst
agents-cli eval run
```

The eval harness covers control cases, sparse-context edge behavior, and the boundary that the agent must not claim final investment approval without review.

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED localhost:3005` | Risk Analysis is not running | `cd servers/risk-analysis && PORT=3005 pnpm start` |
| `agents-cli info` cannot find the project | Command was run from the wrong directory | `cd agents/risk-analyst` |
| Python import error for `mcp` or `google.adk` | Dependencies are not installed | `uv sync --extra eval` or `agents-cli install` |
| Live eval needs credentials | Provider credentials are absent | Run shape tests with `uv run pytest`; live eval can run when credentials are configured |
