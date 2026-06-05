# Deployment — @shaleyeah/risk-analyst

> **Status: Planned** — Not yet implemented. See [#366](https://github.com/ryemyster/ShaleYeah/issues/366).

## Environment variables (planned)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM calls |
| `RISK_ANALYSIS_MCP_URL` | No | `http://localhost:3005` | risk-analysis server URL |
| `PORT` | No | `4005` | Agent endpoint port |

## Pair ports

| Service | Port |
|---------|------|
| risk-analysis (Tier 1) | 3005 |
| risk-analyst (Tier 2) | 4005 |
