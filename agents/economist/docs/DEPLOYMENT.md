# Deployment — @shaleyeah/economist

> **Status: Planned** — Not yet implemented. See [#364](https://github.com/ryemyster/ShaleYeah/issues/364).

## Planned deployment

Same pattern as geologist. See `agents/geologist/docs/DEPLOYMENT.md` for the full reference.

## Environment variables (planned)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM calls |
| `ECONOBOT_MCP_URL` | No | `http://localhost:3002` | econobot server URL |
| `PORT` | No | `4002` | Agent endpoint port |

## Pair ports

| Service | Port |
|---------|------|
| econobot (Tier 1) | 3002 |
| economist (Tier 2) | 4002 |
