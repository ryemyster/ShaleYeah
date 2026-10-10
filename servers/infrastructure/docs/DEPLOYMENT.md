# Deployment — @shaleyeah/server-infrastructure

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3012` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3012 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis (Structura Ingenious) |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3012`) |
| `DATA_PATH` | No | `./data` | Path to infrastructure data |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Docker Compose (agent pair)

```yaml
services:
  infrastructure:
    image: shaleyeah/infrastructure:latest
    environment:
      PORT: "3012"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3012:3012"
  infrastructure-planner:
    image: shaleyeah/infrastructure-planner:latest
    environment:
      INFRASTRUCTURE_MCP_URL: http://infrastructure:3012
    depends_on: [infrastructure]
```

## Kong gateway

```bash
curl -X POST http://kong:8001/upstreams -d name=infrastructure
curl -X POST http://kong:8001/upstreams/infrastructure/targets -d target=infrastructure:3012
curl -X POST http://kong:8001/services -d name=infrastructure -d host=infrastructure
curl -X POST http://kong:8001/services/infrastructure/routes -d paths[]=/mcp/infrastructure
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3012` set
- [ ] Registered with Kong at `/mcp/infrastructure`
- [ ] Paired with `infrastructure-planner` ADK agent through `INFRASTRUCTURE_MCP_URL`
