# Deployment — Research MCP Server

Deploy this package as the Research MCP backend. Deploy the ADK agent from `agents/research-analyst` separately.

## Commands

```bash
cd servers/research
pnpm build
PORT=3008 pnpm start
```

Without `PORT`, the server runs in stdio mode for local MCP clients. With `PORT=3008`, it runs over Streamable HTTP for the ADK agent or other MCP callers.

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | No | unset | Enables optional LLM synthesis through shared `callLLM`; deterministic fallback is used when unavailable |
| `PORT` | No | stdio | Set to `3008` for HTTP transport |

Approved source or subscription credentials should be supplied by deployment infrastructure, not checked into this package.

## Pairing With The Agent

When the server is deployed somewhere other than `http://localhost:3008`, configure the agent with:

```bash
RESEARCH_MCP_URL=https://your-research-mcp.example.com
```

The agent and server should remain independently deployable.
