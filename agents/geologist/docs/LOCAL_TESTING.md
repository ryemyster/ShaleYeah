# Local Testing — Geologist ADK Agent + Geowiz

The Geologist agent is ADK/Python. The Geowiz server is the TypeScript MCP backend it calls over HTTP.

## Verify The Agent Package

```bash
cd agents/geologist
uv run pytest
uv run python -m py_compile app/agent.py app/geowiz_mcp.py
agents-cli info
```

`agents-cli info` should detect `agents/geologist` as the project. It should not require or create ADK files at repo root.

## Run With A Live Geowiz Backend

Start the MCP server in one terminal:

```bash
cd servers/geowiz
PORT=3001 pnpm start
```

Run the ADK agent in another terminal:

```bash
cd agents/geologist
agents-cli install
GEOWIZ_MCP_URL=http://localhost:3001 agents-cli run \
  "Use assess_geowiz_quality to assess sample.las as LAS data"
```

This exercises `app/agent.py` and `app/geowiz_mcp.py`.

## Run ADK Evals

```bash
cd agents/geologist
agents-cli eval run
```

The eval harness covers control cases, sparse-context edge behavior, and the boundary that the agent must not persist findings without approval.

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED localhost:3001` | Geowiz is not running | `cd servers/geowiz && PORT=3001 pnpm start` |
| `agents-cli info` cannot find the project | Command was run from the wrong directory | `cd agents/geologist` |
| Python import error for `mcp` or `google.adk` | Dependencies are not installed | `uv sync --extra eval` or `agents-cli install` |
| Live eval needs credentials | Provider credentials are absent | Run shape tests with `uv run pytest`; live eval can run when credentials are configured |

## See Also

- [README](../README.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DEVELOPMENT.md](DEVELOPMENT.md)
