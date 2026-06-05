# Deployment — @shaleyeah/server-reporter

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3009` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3009 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis (Scriptor Reporticus Maximus) |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3009`) |
| `DATA_PATH` | No | `./data` | Path to report templates directory |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Docker Compose (agent pair)

```yaml
services:
  reporter:
    image: shaleyeah/reporter:latest
    environment:
      PORT: "3009"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3009:3009"
  reporter-agent:
    image: shaleyeah/reporter-agent:latest
    environment:
      REPORTER_MCP_URL: http://reporter:3009
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [reporter]
```

## Kong gateway

```bash
curl -X POST http://kong:8001/upstreams -d name=reporter
curl -X POST http://kong:8001/upstreams/reporter/targets -d target=reporter:3009
curl -X POST http://kong:8001/services -d name=reporter -d host=reporter
curl -X POST http://kong:8001/services/reporter/routes -d paths[]=/mcp/reporter
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3009` set
- [ ] Registered with Kong at `/mcp/reporter`
- [ ] Paired with `reporter-agent` at port 4009
