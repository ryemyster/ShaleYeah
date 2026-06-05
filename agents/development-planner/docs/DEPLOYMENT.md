# Deployment — @shaleyeah/development-planner

> **Status: Planned** — Not yet implemented. See [#373](https://github.com/ryemyster/ShaleYeah/issues/373).

## Environment variables (planned)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM calls |
| `DEVELOPMENT_MCP_URL` | No | `http://localhost:3011` | development server URL |
| `PORT` | No | `4011` | Agent endpoint port |

## Pair ports

| Service | Port |
|---------|------|
| development (Tier 1) | 3011 |
| development-planner (Tier 2) | 4011 |
