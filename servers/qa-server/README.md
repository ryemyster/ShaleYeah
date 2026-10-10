# @shaleyeah/server-qa

Quentin Assurance — QA Engineer — one of the 14 specialist AI agents in the ShaleYeah deal team.

## Quick start

```bash
pnpm start   # launch as standalone MCP server
```

Connect via Claude Desktop or any MCP-compatible client:
```json
{ "mcpServers": { "qa-server": { "command": "pnpm", "args": ["--filter", "@shaleyeah/server-qa", "start"] } } }
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
