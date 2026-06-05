# Deployment — @shaleyeah/server-drilling

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3003` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3003 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis (Perforator Maximus) |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3003`) |
| `DATA_PATH` | No | `./data` | Path to drilling data directory |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Build and run

```bash
cd servers/drilling
pnpm install && pnpm build
PORT=3003 ANTHROPIC_API_KEY=sk-... pnpm start
```

## Docker Compose (agent pair)

```yaml
services:
  drilling:
    image: shaleyeah/drilling:latest
    environment:
      PORT: "3003"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3003:3003"
  drilling-engineer:
    image: shaleyeah/drilling-engineer:latest
    environment:
      DRILLING_MCP_URL: http://drilling:3003
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [drilling]
```

## Kong gateway

```bash
curl -X POST http://kong:8001/upstreams -d name=drilling
curl -X POST http://kong:8001/upstreams/drilling/targets -d target=drilling:3003
curl -X POST http://kong:8001/services -d name=drilling -d host=drilling
curl -X POST http://kong:8001/services/drilling/routes -d paths[]=/mcp/drilling
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3003` set
- [ ] Registered with Kong at `/mcp/drilling`
- [ ] Paired with `drilling-engineer` agent at port 4003
