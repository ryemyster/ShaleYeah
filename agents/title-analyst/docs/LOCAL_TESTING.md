# Local Testing — Title Analyst ADK Agent + Title

The Title Analyst agent is ADK/Python. The Title server is the TypeScript MCP backend it calls over HTTP.

## Verify The Agent Package

```bash
cd agents/title-analyst
uv run pytest
uv run python -m py_compile app/agent.py app/title_mcp.py
agents-cli info
```

`agents-cli info` should detect `agents/title-analyst` as the project. It should not require or create ADK files at repo root.

## Run With A Live Title Backend

Start the MCP server in one terminal:

```bash
cd servers/title
PORT=3010 pnpm start
```

Run the ADK agent in another terminal:

```bash
cd agents/title-analyst
agents-cli install
TITLE_MCP_URL=http://localhost:3010 agents-cli run \
  "Examine ownership for Section 12 in Reeves County, Texas"
```

## Run ADK Evals

```bash
cd agents/title-analyst
agents-cli eval run
```

The eval harness covers control cases, sparse-context edge behavior, and the boundary that the agent must not claim final clean title or legal approval without review.

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED localhost:3010` | Title is not running | `cd servers/title && PORT=3010 pnpm start` |
| `agents-cli info` cannot find the project | Command was run from the wrong directory | `cd agents/title-analyst` |
| Python import error for `mcp` or `google.adk` | Dependencies are not installed | `uv sync --extra eval` or `agents-cli install` |
| Live eval needs credentials | Provider credentials are absent | Run shape tests with `uv run pytest`; live eval can run when credentials are configured |
