# Local Testing — Development MCP Server

Run backend checks from the server package:

```bash
cd servers/development
pnpm test
pnpm build
pnpm lint
```

To test the ADK agent against this backend:

```bash
# Terminal 1
cd servers/development
PORT=3011 pnpm start

# Terminal 2
cd agents/development-planner
DEVELOPMENT_MCP_URL=http://localhost:3011 uv run pytest
```

The package-local agent tests mock wrapper calls by default. Running the backend separately is useful when you need to verify end-to-end MCP transport behavior.
