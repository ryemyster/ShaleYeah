# Deployment — @shaleyeah/infrastructure-planner

> **Status: Planned** — Not yet implemented. See [#375](https://github.com/ryemyster/ShaleYeah/issues/375).

## Environment variables (planned)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM calls |
| `INFRASTRUCTURE_MCP_URL` | No | `http://localhost:3012` | infrastructure server URL |
| `PORT` | No | `4012` | Agent endpoint port |

## Pair ports

| Service | Port |
|---------|------|
| infrastructure (Tier 1) | 3012 |
| infrastructure-planner (Tier 2) | 4012 |
