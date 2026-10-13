# Deployment — @shaleyeah/quality-assurance

## Standalone

```bash
pnpm build
pnpm start
```

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | LLM synthesis |

## qa-server dependency

The agent connects to `@shaleyeah/server-qa` over HTTP. Start qa-server before the agent:

```bash
PORT=3004 cd servers/qa-server && pnpm start
```

The URL defaults to `http://localhost:3004` and can be overridden by providing a custom `AgentRuntimeConfig` with `mcpServers["qa-server"].url` set to your deployment address.
