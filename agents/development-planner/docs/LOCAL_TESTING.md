# Local Testing

Run tests from the agent package:

```bash
cd agents/development-planner
uv run pytest
```

Run a syntax check:

```bash
cd agents/development-planner
uv run python -m py_compile app/agent.py app/development_mcp.py
```

## Test With The MCP Backend

Start the Development MCP backend in a separate terminal:

```bash
cd servers/development
PORT=3011 pnpm start
```

Then point the agent at it:

```bash
cd agents/development-planner
DEVELOPMENT_MCP_URL=http://localhost:3011 uv run pytest
```

The default URL is already `http://localhost:3011`, so the environment variable is only needed when the backend runs elsewhere.

## What The Tests Cover

- ADK project shape and manifest location.
- ADK files stay package-local while the TypeScript MCP backend remains separate.
- Python MCP wrappers map arguments to the Development MCP contract.
- Eval fixtures include control, edge, and human-review boundary cases.
