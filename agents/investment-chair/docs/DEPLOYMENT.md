# Deployment — @shaleyeah/investment-chair

> **Status: Planned** — Not yet implemented. See [#367](https://github.com/ryemyster/ShaleYeah/issues/367).

## Environment variables (planned)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Yes | — | LLM calls (Opus-class recommended for deep-reasoning) |
| `DECISION_MCP_URL` | No | `http://localhost:3013` | decision server URL |
| `PORT` | No | `4013` | Agent endpoint port |

## Pair ports

| Service | Port |
|---------|------|
| decision (Tier 1) | 3013 |
| investment-chair (Tier 2) | 4013 |

## Production note

The investment chair uses `deep-reasoning` model routing extensively, which maps to `claude-opus-4-8`. Budget accordingly — each `runInvestmentChairTask` call may consume significantly more tokens than domain-specialist agents.
