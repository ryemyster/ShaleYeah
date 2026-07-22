# Deployment — @shaleyeah/server-econobot

## Transport modes

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI |
| **HTTP** | `PORT=3002` | Agent fleet, Docker, Kong |

```bash
# stdio mode
pnpm build && pnpm start

# HTTP mode
PORT=3002 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis calls |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3002`) |
| `DATA_PATH` | No | `./data` | Path to economic data directory |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Build and run

```bash
cd servers/econobot
pnpm install && pnpm build
PORT=3002 ANTHROPIC_API_KEY=sk-... pnpm start
```

## Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY dist/ ./dist/
COPY package.json ./
RUN npm install --omit=dev
ENV PORT=3002
CMD ["node", "dist/index.js"]
```

## Docker Compose (agent pair)

```yaml
services:
  econobot:
    image: shaleyeah/econobot:latest
    environment:
      PORT: "3002"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3002:3002"
  economist:
    image: shaleyeah/economist:latest
    environment:
      ECONOBOT_MCP_URL: http://econobot:3002
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [econobot]
```

## Kong gateway registration

```bash
curl -X POST http://kong:8001/upstreams -d name=econobot
curl -X POST http://kong:8001/upstreams/econobot/targets -d target=econobot:3002
curl -X POST http://kong:8001/services -d name=econobot -d host=econobot
curl -X POST http://kong:8001/services/econobot/routes -d paths[]=/mcp/econobot
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3002` set
- [ ] Registered with Kong at `/mcp/econobot`
- [ ] Paired with `economist` agent at port 4002
