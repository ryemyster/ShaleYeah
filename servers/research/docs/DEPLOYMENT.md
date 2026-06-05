# Deployment — @shaleyeah/server-research

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3008` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3008 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis (Scientius Researchicus) |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3008`) |
| `DATA_PATH` | No | `./data` | Path to research data directory |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Docker Compose (agent pair)

```yaml
services:
  research:
    image: shaleyeah/research:latest
    environment:
      PORT: "3008"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3008:3008"
  research-analyst:
    image: shaleyeah/research-analyst:latest
    environment:
      RESEARCH_MCP_URL: http://research:3008
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [research]
```

## Kong gateway

```bash
curl -X POST http://kong:8001/upstreams -d name=research
curl -X POST http://kong:8001/upstreams/research/targets -d target=research:3008
curl -X POST http://kong:8001/services -d name=research -d host=research
curl -X POST http://kong:8001/services/research/routes -d paths[]=/mcp/research
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3008` set
- [ ] Registered with Kong at `/mcp/research`
- [ ] Paired with `research-analyst` agent at port 4008
