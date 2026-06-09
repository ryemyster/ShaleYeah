# Deployment — @shaleyeah/geologist

The geologist agent is a Tier 2 service that wraps the geowiz Tier 1 MCP server. Both must be deployed for the agent to function.

## Prerequisites

- Node.js 20+
- `ANTHROPIC_API_KEY` (Anthropic Claude API access)
- geowiz server accessible from the agent (same host or network)

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic Claude API key; used by `callLLM` for the reasoning loop |
| `GEOWIZ_MCP_URL` | No | `http://localhost:3001` | geowiz Tier 1 server URL |
| `PORT` | No | `4001` | Port for the LocalAgentEndpoint HTTP server |
| `LOG_LEVEL` | No | `info` | Audit log verbosity |

## Scopes in production

The geologist declares two scope levels:

| Scope | Tools | Required from caller |
|-------|-------|---------------------|
| `read:geology` | All 8 analysis tools | Yes — pass in `grantedScopes: ["read:geology"]` per call |
| `write:geology` | `geologist.save_finding` | Yes — plus a human approval challenge response |

When `grantedScopes` is omitted from `execute()`, scope enforcement is skipped (backward-compatible). For production, always provide `grantedScopes` so the Permission Gate enforces least-privilege.

## Findings storage

`geologist.save_finding` writes to `./data/geowiz/findings/<finding-id>.json` relative to geowiz's working directory. In production:
- Mount a persistent volume at `./data/geowiz/` on the geowiz container
- Findings accumulate as append-only JSON files
- pgvector promotion (semantic recall) is deferred to issue #405

## Build

```bash
# From repo root — builds sdk first (required), then all packages
pnpm turbo build

# Or build only the pair
pnpm --filter @shaleyeah/server-geowiz build
pnpm --filter @shaleyeah/geologist build
```

## Run locally (development)

```bash
# Terminal 1: Tier 1 — geowiz
cd servers/geowiz
PORT=3001 pnpm start

# Terminal 2: Tier 2 — geologist
cd agents/geologist
ANTHROPIC_API_KEY=sk-ant-... GEOWIZ_MCP_URL=http://localhost:3001 pnpm start
```

## Run as Docker containers

```dockerfile
# Example docker-compose.yml for the geowiz+geologist pair
services:
  geowiz:
    build: ./servers/geowiz
    ports: ["3001:3001"]
    volumes:
      - geowiz-data:/app/data
    environment:
      PORT: "3001"

  geologist:
    build: ./agents/geologist
    ports: ["4001:4001"]
    depends_on: [geowiz]
    environment:
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
      GEOWIZ_MCP_URL: "http://geowiz:3001"
      PORT: "4001"

volumes:
  geowiz-data:
```

## BYOE model routing override

Operators can override the default model routing without touching code — inject `AgentRuntimeConfig.modelRouting` at startup:

```typescript
import { createGeologistRuntime, geologistConfig } from "@shaleyeah/geologist";

const runtime = createGeologistRuntime({
    ...geologistConfig,
    modelRouting: {
        ...geologistConfig.modelRouting,
        "standard-analysis": {
            provider: "azure-openai",
            model: "gpt-4o",
        },
    },
});
```

The reasoning loop reads `config.modelRouting["standard-analysis"].model` at each LLM call, so there is no restart needed if config is injected dynamically.

## Health check

```bash
# geowiz health (Tier 1 — available immediately, no MCP session required)
curl http://localhost:3001/health
# → { "status": "ok", "server": "geowiz", "version": "0.1.0" }

# geologist agent endpoint health
curl http://localhost:4001/health
```

## Kong gateway (production)

Register the geologist agent endpoint with Kong after deployment:

```bash
# Register the upstream service
curl -X POST http://kong:8001/services \
  -d name=geologist \
  -d url=http://geologist:4001

# Register the route
curl -X POST http://kong:8001/services/geologist/routes \
  -d paths[]=/agents/geologist
```

Requests to the fleet then go through: `Kong → geologist:4001 → geowiz:3001`.

## Scaling

**geowiz (Tier 1):** Stateless — scale horizontally behind a load balancer. Each geologist instance can point to any geowiz replica.

**geologist (Tier 2):** Stateful during an active `runGeologistTask` loop (in-memory history). Run one replica per concurrent task, or implement external task state storage (see #396 Async Job pattern for long-running tasks).

## Observability

- **Audit log:** Every `runtime.execute()` call emits a JSON line to stderr. Route stderr to your log aggregator (Datadog, Loki, etc.).
- **Retry events:** `executeWithRetry()` logs each retry attempt with attempt number and delay before emitting. Watch for consecutive retries as a signal of geowiz instability.
- **Span tracing:** Not yet implemented — deferred post-MVP.
- **Metrics:** Not yet implemented — deferred post-MVP.

## Production config checklist

- [ ] `ANTHROPIC_API_KEY` in secret manager (not env file)
- [ ] `GEOWIZ_MCP_URL` points to production geowiz service
- [ ] Persistent volume mounted at `./data/geowiz/` on geowiz container (findings storage)
- [ ] `hitl.approvalMode` is `"when-sensitive"` or `"always"` — `save_finding` always requires human approval regardless of this setting
- [ ] `grantedScopes` provided on every `execute()` call in production — enables Permission Gate enforcement
- [ ] Audit log stderr piped to persistent log sink
- [ ] Health check endpoints registered with load balancer
- [ ] Kong route registered
- [ ] Resource limits set (memory: 512Mi, CPU: 0.5 per container is a reasonable starting point)
- [ ] Model routing overridden if using non-Anthropic LLM provider
