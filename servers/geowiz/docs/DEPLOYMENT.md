# Deployment — @shaleyeah/server-geowiz

## Transport modes

Geowiz supports two transport modes controlled by the `PORT` environment variable.

| Mode | When | Use case |
|------|------|----------|
| **stdio** | `PORT` not set | Claude Desktop, MCP CLI, direct process pipe |
| **HTTP (StreamableHTTP)** | `PORT=3001` | Agent fleet, Docker, Kubernetes, Kong |

```bash
# stdio mode (MCP client connects via pipe)
pnpm build && pnpm start

# HTTP mode (binds :3001, accepts MCP-over-HTTP)
PORT=3001 pnpm start
```

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM synthesis calls |
| `PORT` | No | stdio | Set to enable HTTP transport (e.g. `3001`) |
| `DATA_PATH` | No | `./data` | Path to data directory |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

## Build and run

```bash
cd servers/geowiz
pnpm install
pnpm build
PORT=3001 ANTHROPIC_API_KEY=sk-... pnpm start
```

Health check (HTTP mode only):

```bash
curl http://localhost:3001/health   # → {"status":"ok","server":"geowiz"}
```

## Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY dist/ ./dist/
COPY package.json ./
RUN npm install --omit=dev
ENV PORT=3001
CMD ["node", "dist/index.js"]
```

```bash
docker build -t shaleyeah/geowiz:latest .
docker run -e ANTHROPIC_API_KEY=sk-... -e PORT=3001 -p 3001:3001 shaleyeah/geowiz:latest
```

## Docker Compose (agent pair)

```yaml
services:
  geowiz:
    image: shaleyeah/geowiz:latest
    environment:
      PORT: "3001"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3001:3001"
  geologist:
    image: shaleyeah/geologist:latest
    environment:
      GEOWIZ_MCP_URL: http://geowiz:3001
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [geowiz]
```

## Kong gateway registration

```bash
# Register upstream
curl -X POST http://kong:8001/upstreams -d name=geowiz

# Add target
curl -X POST http://kong:8001/upstreams/geowiz/targets \
  -d target=geowiz:3001

# Create service + route
curl -X POST http://kong:8001/services \
  -d name=geowiz -d host=geowiz
curl -X POST http://kong:8001/services/geowiz/routes \
  -d paths[]=/mcp/geowiz
```

## Production checklist

- [ ] `ANTHROPIC_API_KEY` set and valid
- [ ] `PORT=3001` set (HTTP mode for fleet)
- [ ] Health endpoint responding
- [ ] Registered with Kong at `/mcp/geowiz`
- [ ] Resource limits set (256 MB RAM recommended)
- [ ] `LOG_LEVEL=warn` or `error` in production
- [ ] Paired with `geologist` agent at port 4001

---

## See also

- [README](../README.md) — quick start, Claude Desktop config, tool table
- [ARCHITECTURE.md](ARCHITECTURE.md) — tool inventory, data flow, LLM call locations
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — plain-language + technical lifecycle
- [INTEGRATION.md](INTEGRATION.md) — calling geowiz tools from an agent or MCP client
- [LOCAL_TESTING.md](LOCAL_TESTING.md) — running locally, testing tools directly
- [DEVELOPMENT.md](DEVELOPMENT.md) — adding tools, LLM wiring pattern, TDD checklist
