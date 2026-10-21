# Deployment — @shaleyeah/reservoir-engineer

> **Status: Planned** — Not yet implemented. See [#365](https://github.com/ryemyster/ShaleYeah/issues/365).

## Environment variables (planned)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM calls |
| `CURVE_SMITH_MCP_URL` | No | `http://localhost:3004` | curve-smith server URL |
| `PORT` | No | `4004` | Agent endpoint port |

## Pair ports

| Service | Port |
|---------|------|
| curve-smith (Tier 1) | 3004 |
| reservoir-engineer (Tier 2) | 4004 |

See `agents/geologist/docs/DEPLOYMENT.md` for the full deployment reference pattern.
