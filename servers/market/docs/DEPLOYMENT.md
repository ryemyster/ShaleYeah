# Deployment — @shaleyeah/server-market

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3007` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3007 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis (Mercatus Analyticus) |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3007`) |
| `EIA_API_KEY` | No | stub prices | EIA API key for live WTI/Henry Hub prices |
| `DATA_PATH` | No | `./data` | Path to market data directory |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

Without `EIA_API_KEY`, stub prices are used silently. See `docs/EIA_API_SETUP.md` for setup instructions.

## Build and run

```bash
cd servers/market
pnpm install && pnpm build
PORT=3007 ANTHROPIC_API_KEY=sk-... EIA_API_KEY=... pnpm start
```

## Docker Compose (agent pair)

```yaml
services:
  market:
    image: shaleyeah/market:latest
    environment:
      PORT: "3007"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      EIA_API_KEY: ${EIA_API_KEY}
    ports:
      - "3007:3007"
  market-analyst:
    image: shaleyeah/market-analyst:latest
    environment:
      MARKET_MCP_URL: http://market:3007
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [market]
```

## Kong gateway

```bash
curl -X POST http://kong:8001/upstreams -d name=market
curl -X POST http://kong:8001/upstreams/market/targets -d target=market:3007
curl -X POST http://kong:8001/services -d name=market -d host=market
curl -X POST http://kong:8001/services/market/routes -d paths[]=/mcp/market
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3007` set
- [ ] `EIA_API_KEY` set (or accept stub prices for dev)
- [ ] Registered with Kong at `/mcp/market`
- [ ] Paired with `market-analyst` agent at port 4007
