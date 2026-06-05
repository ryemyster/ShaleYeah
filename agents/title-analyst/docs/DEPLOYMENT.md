# Deployment — @shaleyeah/title-analyst

> **Status: Planned** — Not yet implemented. See [#372](https://github.com/ryemyster/ShaleYeah/issues/372).

## Environment variables (planned)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM calls |
| `TITLE_MCP_URL` | No | `http://localhost:3010` | title server URL |
| `PORT` | No | `4010` | Agent endpoint port |

## Pair ports

| Service | Port |
|---------|------|
| title (Tier 1) | 3010 |
| title-analyst (Tier 2) | 4010 |
