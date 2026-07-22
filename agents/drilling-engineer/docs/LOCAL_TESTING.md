# Local Testing — Drilling Engineer ADK Agent + Drilling

The Drilling Engineer agent is ADK/Python. The Drilling server is the TypeScript MCP backend it calls over HTTP.

## Verify The Agent Package

```bash
cd agents/drilling-engineer
uv run pytest
uv run python -m py_compile app/agent.py app/drilling_mcp.py
agents-cli info
```

`agents-cli info` should detect `agents/drilling-engineer` as the project. It should not require or create ADK files at repo root.

## Run With A Live Drilling Backend

Start the MCP server in one terminal:

```bash
cd servers/drilling
PORT=3003 pnpm start
```

Run the ADK agent in another terminal:

```bash
cd agents/drilling-engineer
agents-cli install
DRILLING_MCP_URL=http://localhost:3003 agents-cli run \
  "Design a drilling program for a horizontal Wolfcamp well at 10000 ft"
```

## Run ADK Evals

```bash
cd agents/drilling-engineer
agents-cli eval run
```

The eval harness covers control cases, sparse-context edge behavior, architecture-boundary behavior, and the boundary that the agent must not claim final drilling program, AFE, spud, or field-execution approval without review.

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED localhost:3003` | Drilling is not running | `cd servers/drilling && PORT=3003 pnpm start` |
| `agents-cli info` cannot find the project | Command was run from the wrong directory | `cd agents/drilling-engineer` |
| Python import error for `mcp` or `google.adk` | Dependencies are not installed | `uv sync --extra eval` or `agents-cli install` |
| Live eval needs credentials | Provider credentials are absent | Run shape tests with `uv run pytest`; live eval can run when credentials are configured |
