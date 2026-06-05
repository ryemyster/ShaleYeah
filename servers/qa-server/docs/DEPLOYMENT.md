# Deployment — @shaleyeah/server-qa

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3014` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3014 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis (Testius Validatus) |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3014`) |
| `DATA_PATH` | No | `./data` | Path to QA data directory |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Docker Compose (agent pair)

```yaml
services:
  qa-server:
    image: shaleyeah/qa-server:latest
    environment:
      PORT: "3014"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3014:3014"
  quality-assurance:
    image: shaleyeah/quality-assurance:latest
    environment:
      QA_SERVER_MCP_URL: http://qa-server:3014
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [qa-server]
```

## Kong gateway

```bash
curl -X POST http://kong:8001/upstreams -d name=qa-server
curl -X POST http://kong:8001/upstreams/qa-server/targets -d target=qa-server:3014
curl -X POST http://kong:8001/services -d name=qa-server -d host=qa-server
curl -X POST http://kong:8001/services/qa-server/routes -d paths[]=/mcp/qa-server
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3014` set
- [ ] Registered with Kong at `/mcp/qa-server`
- [ ] Paired with `quality-assurance` agent at port 4014
