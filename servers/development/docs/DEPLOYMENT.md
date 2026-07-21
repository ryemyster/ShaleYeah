# Deployment — Development MCP Server

Deploy this package as the Development MCP backend. Deploy the ADK agent from `agents/development-planner` separately.

## Commands

```bash
cd servers/development
pnpm build
PORT=3011 pnpm start
```

Without `PORT`, the server runs in stdio mode for local MCP clients. With `PORT=3011`, it runs over Streamable HTTP for the ADK agent or other MCP callers.

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | No | unset | Enables optional LLM synthesis through shared `callLLM`; deterministic fallback is used when unavailable |
| `PORT` | No | stdio | Set to `3011` for HTTP transport |

## Pairing With The Agent

When the server is deployed somewhere other than `http://localhost:3011`, configure the agent with:

```bash
DEVELOPMENT_MCP_URL=https://your-development-mcp.example.com
```

The agent and server should remain independently deployable.
