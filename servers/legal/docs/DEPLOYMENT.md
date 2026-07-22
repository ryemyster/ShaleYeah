# Deployment — @shaleyeah/server-legal

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3006` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3006 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis (Legatus Juridicus) |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3006`) |
| `DATA_PATH` | No | `./data` | Path to contracts and legal documents |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Docker Compose (agent pair)

```yaml
services:
  legal:
    image: shaleyeah/legal:latest
    environment:
      PORT: "3006"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3006:3006"
  legal-analyst:
    image: shaleyeah/legal-analyst:latest
    environment:
      LEGAL_MCP_URL: http://legal:3006
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [legal]
```

## Kong gateway

```bash
curl -X POST http://kong:8001/upstreams -d name=legal
curl -X POST http://kong:8001/upstreams/legal/targets -d target=legal:3006
curl -X POST http://kong:8001/services -d name=legal -d host=legal
curl -X POST http://kong:8001/services/legal/routes -d paths[]=/mcp/legal
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3006` set
- [ ] Registered with Kong at `/mcp/legal`
- [ ] Paired with `legal-analyst` agent at port 4006
