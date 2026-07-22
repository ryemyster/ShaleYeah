# @shaleyeah/server-decision

Claudius Maximus — Investment Chair — one of the 14 specialist AI agents in the ShaleYeah deal team.

## Quick start

```bash
pnpm start   # launch as standalone MCP server
```

Connect via Claude Desktop or any MCP-compatible client:
```json
{ "mcpServers": { "decision": { "command": "pnpm", "args": ["--filter", "@shaleyeah/server-decision", "start"] } } }
```

## Building

```bash
pnpm build        # compile to dist/
pnpm type-check   # type-only, no emit
```

## Environment

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Required for LLM synthesis calls |
