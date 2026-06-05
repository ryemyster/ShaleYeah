# Deployment — @shaleyeah/server-development

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3011` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3011 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis (Architectus Developmentus) |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3011`) |
| `DATA_PATH` | No | `./data` | Path to development plan data |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Docker Compose (agent pair)

```yaml
services:
  development:
    image: shaleyeah/development:latest
    environment:
      PORT: "3011"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3011:3011"
  development-planner:
    image: shaleyeah/development-planner:latest
    environment:
      DEVELOPMENT_MCP_URL: http://development:3011
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [development]
```

## Kong gateway

```bash
curl -X POST http://kong:8001/upstreams -d name=development
curl -X POST http://kong:8001/upstreams/development/targets -d target=development:3011
curl -X POST http://kong:8001/services -d name=development -d host=development
curl -X POST http://kong:8001/services/development/routes -d paths[]=/mcp/development
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3011` set
- [ ] Registered with Kong at `/mcp/development`
- [ ] Paired with `development-planner` agent at port 4011
