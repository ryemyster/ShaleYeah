# Development

Run commands from the agent package:

```bash
cd agents/infrastructure-planner
uv run pytest
```

The ADK entrypoint is `app/agent.py`. The Python MCP wrappers are in `app/infrastructure_mcp.py`.

## Backend Pair

Start the Infrastructure MCP backend separately when testing live MCP calls:

```bash
cd servers/infrastructure
PORT=3012 pnpm start
```

The agent reads `INFRASTRUCTURE_MCP_URL`, defaulting to `http://localhost:3012`.

## Development Rules

- Keep this package independently buildable and extractable.
- Keep backend changes in `servers/infrastructure`.
- Add pytest coverage for deterministic Python wrapper behavior.
- Add ADK eval cases for behavior, tool choice, missing inputs, and HITL boundaries.
- Do not store secrets, proprietary midstream data, asset details, ROW terms, or environmental studies in checked-in files.
