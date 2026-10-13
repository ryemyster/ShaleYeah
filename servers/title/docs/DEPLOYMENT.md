# Deployment — @shaleyeah/server-title

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3010` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3010 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis (Titulus Verificatus) |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3010`) |
| `DATA_PATH` | No | `./data` | Path to title data directory |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Docker Compose (agent pair)

```yaml
services:
  title:
    image: shaleyeah/title:latest
    environment:
      PORT: "3010"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3010:3010"
  title-analyst:
    image: shaleyeah/title-analyst:latest
    environment:
      TITLE_MCP_URL: http://title:3010
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [title]
```

## Kong gateway

```bash
curl -X POST http://kong:8001/upstreams -d name=title
curl -X POST http://kong:8001/upstreams/title/targets -d target=title:3010
curl -X POST http://kong:8001/services -d name=title -d host=title
curl -X POST http://kong:8001/services/title/routes -d paths[]=/mcp/title
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3010` set
- [ ] Registered with Kong at `/mcp/title`
- [ ] Paired with `title-analyst` agent at port 4010
