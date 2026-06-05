# Deployment — @shaleyeah/server-curve-smith

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3004` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3004 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis (Lucius Technicus Engineer) |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3004`) |
| `DATA_PATH` | No | `./data` | Path to production data directory |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Build and run

```bash
cd servers/curve-smith
pnpm install && pnpm build
PORT=3004 ANTHROPIC_API_KEY=sk-... pnpm start
```

## Docker Compose (agent pair)

```yaml
services:
  curve-smith:
    image: shaleyeah/curve-smith:latest
    environment:
      PORT: "3004"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3004:3004"
  reservoir-engineer:
    image: shaleyeah/reservoir-engineer:latest
    environment:
      CURVE_SMITH_MCP_URL: http://curve-smith:3004
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [curve-smith]
```

## Kong gateway

```bash
curl -X POST http://kong:8001/upstreams -d name=curve-smith
curl -X POST http://kong:8001/upstreams/curve-smith/targets -d target=curve-smith:3004
curl -X POST http://kong:8001/services -d name=curve-smith -d host=curve-smith
curl -X POST http://kong:8001/services/curve-smith/routes -d paths[]=/mcp/curve-smith
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3004` set
- [ ] Registered with Kong at `/mcp/curve-smith`
- [ ] Paired with `reservoir-engineer` agent at port 4004
