# Deployment — @shaleyeah/research-analyst

> **Status: Planned** — Not yet implemented. See [#369](https://github.com/ryemyster/ShaleYeah/issues/369).

## Environment variables (planned)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM calls |
| `RESEARCH_MCP_URL` | No | `http://localhost:3008` | research server URL |
| `PORT` | No | `4008` | Agent endpoint port |

## Pair ports

| Service | Port |
|---------|------|
| research (Tier 1) | 3008 |
| research-analyst (Tier 2) | 4008 |
