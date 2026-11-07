# Deployment — @shaleyeah/server-risk-analysis

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3005` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3005 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis (Gaius Probabilis Assessor) |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3005`) |
| `DATA_PATH` | No | `./data` | Path to risk data directory |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Build and run

```bash
cd servers/risk-analysis
pnpm install && pnpm build
PORT=3005 ANTHROPIC_API_KEY=sk-... pnpm start
```

## Docker Compose (agent pair)

```yaml
services:
  risk-analysis:
    image: shaleyeah/risk-analysis:latest
    environment:
      PORT: "3005"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3005:3005"
  risk-analyst:
    image: shaleyeah/risk-analyst:latest
    environment:
      RISK_ANALYSIS_MCP_URL: http://risk-analysis:3005
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [risk-analysis]
```

## Kong gateway

```bash
curl -X POST http://kong:8001/upstreams -d name=risk-analysis
curl -X POST http://kong:8001/upstreams/risk-analysis/targets -d target=risk-analysis:3005
curl -X POST http://kong:8001/services -d name=risk-analysis -d host=risk-analysis
curl -X POST http://kong:8001/services/risk-analysis/routes -d paths[]=/mcp/risk-analysis
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3005` set
- [ ] Registered with Kong at `/mcp/risk-analysis`
- [ ] Paired with `risk-analyst` agent at port 4005
