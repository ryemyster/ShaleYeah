# Deployment — @shaleyeah/market-analyst

> **Status: Planned** — Not yet implemented. See [#371](https://github.com/ryemyster/ShaleYeah/issues/371).

## Environment variables (planned)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM calls |
| `MARKET_MCP_URL` | No | `http://localhost:3007` | market server URL |
| `PORT` | No | `4007` | Agent endpoint port |

## Pair ports

| Service | Port |
|---------|------|
| market (Tier 1) | 3007 |
| market-analyst (Tier 2) | 4007 |
