# Deployment — @shaleyeah/server-decision

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3013` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3013 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis (Augustus Decidius Maximus) |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3013`) |
| `DATA_PATH` | No | `./data` | Path to decision data directory |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Docker Compose (agent pair)

```yaml
services:
  decision:
    image: shaleyeah/decision:latest
    environment:
      PORT: "3013"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3013:3013"
  investment-chair:
    image: shaleyeah/investment-chair:latest
    environment:
      DECISION_MCP_URL: http://decision:3013
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [decision]
```

## Kong gateway

```bash
curl -X POST http://kong:8001/upstreams -d name=decision
curl -X POST http://kong:8001/upstreams/decision/targets -d target=decision:3013
curl -X POST http://kong:8001/services -d name=decision -d host=decision
curl -X POST http://kong:8001/services/decision/routes -d paths[]=/mcp/decision
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3013` set
- [ ] Registered with Kong at `/mcp/decision`
- [ ] Paired with `investment-chair` agent at port 4013
