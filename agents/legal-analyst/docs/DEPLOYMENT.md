# Deployment — @shaleyeah/legal-analyst

> **Status: Planned** — Not yet implemented. See [#370](https://github.com/ryemyster/ShaleYeah/issues/370).

## Environment variables (planned)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM calls |
| `LEGAL_MCP_URL` | No | `http://localhost:3006` | legal server URL |
| `PORT` | No | `4006` | Agent endpoint port |

## Pair ports

| Service | Port |
|---------|------|
| legal (Tier 1) | 3006 |
| legal-analyst (Tier 2) | 4006 |
