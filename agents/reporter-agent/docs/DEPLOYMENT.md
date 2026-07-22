# Deployment — @shaleyeah/reporter-agent

> **Status: Planned** — Not yet implemented. See [#368](https://github.com/ryemyster/ShaleYeah/issues/368).

## Environment variables (planned)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM calls |
| `REPORTER_MCP_URL` | No | `http://localhost:3009` | reporter server URL |
| `PORT` | No | `4009` | Agent endpoint port |
| `REPORT_OUTPUT_DIR` | No | `/tmp/reports` | Where exported reports are written |

## Pair ports

| Service | Port |
|---------|------|
| reporter (Tier 1) | 3009 |
| reporter-agent (Tier 2) | 4009 |
