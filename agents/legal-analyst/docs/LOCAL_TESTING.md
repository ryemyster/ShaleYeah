# Local Testing - Legal Analyst ADK Agent

Use package-local Python commands for the agent.

## Fast Verification

```bash
cd agents/legal-analyst
uv run pytest
uv run python -m py_compile app/agent.py app/legal_mcp.py
agents-cli info
```

## Live Backend Verification

Start the Legal MCP server in another shell:

```bash
cd servers/legal
PORT=3006 pnpm start
```

Then run the ADK agent:

```bash
cd agents/legal-analyst
LEGAL_MCP_URL=http://localhost:3006 agents-cli run \
  "Analyze legal exposure for a Texas development project covering three Permian leases"
```

## Eval Verification

```bash
cd agents/legal-analyst
agents-cli eval run
```

If credentials are unavailable, keep the pytest eval-shape tests passing so the dataset and config remain in place for CI or credentialed local runs.

## Common Failures

`LEGAL_MCP_URL` connection errors mean the backend server is not running or the URL is wrong.

An npm, TypeScript, or `src/agent` file under `agents/legal-analyst` means the agent package has regressed from the ADK migration boundary.
