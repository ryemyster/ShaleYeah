# Deployment — @shaleyeah/drilling-engineer

> **Status: Planned** — Not yet implemented. See [#374](https://github.com/ryemyster/ShaleYeah/issues/374).

## Environment variables (planned)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM calls |
| `DRILLING_MCP_URL` | No | `http://localhost:3003` | drilling server URL |
| `PORT` | No | `4003` | Agent endpoint port |

## Pair ports

| Service | Port |
|---------|------|
| drilling (Tier 1) | 3003 |
| drilling-engineer (Tier 2) | 4003 |

See `agents/geologist/docs/DEPLOYMENT.md` for the full deployment reference pattern.
