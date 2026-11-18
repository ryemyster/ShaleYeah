# Research MCP Server

`servers/research` is the TypeScript MCP backend for oil and gas market intelligence and competitive analysis. The ADK agent lives separately in `agents/research-analyst`.

## Quick start

```bash
pnpm start   # launch as standalone MCP server
```

Connect via Claude Desktop or any MCP-compatible client:
```json
{ "mcpServers": { "research": { "command": "pnpm", "args": ["--filter", "@shaleyeah/server-research", "start"] } } }
```

## Building

```bash
pnpm build        # compile to dist/
pnpm type-check   # type-only, no emit
```

## Tools

| Tool | Purpose |
|------|---------|
| `conduct_market_research` | Market, commodity, policy, technology, or source-backed research |
| `analyze_competition` | Regional operator and competitor analysis |

## Environment

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Required for LLM synthesis calls |
