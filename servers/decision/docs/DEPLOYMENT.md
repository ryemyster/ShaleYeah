# Deployment — @shaleyeah/server-decision

## Standalone MCP server

```bash
pnpm build
pnpm start
```

Listens on stdio (MCP default transport).

## Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY dist/ ./dist/
COPY package.json ./
RUN npm install --omit=dev
CMD ["node", "dist/index.js"]
```

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | LLM synthesis calls |
| `DATA_PATH` | No | Path to data directory (default: ./data) |

## Kong gateway

Register as `decision` upstream. Route: `/mcp/decision` → `<host>:3000`.
