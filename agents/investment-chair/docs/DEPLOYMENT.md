# Deployment

`agents/investment-chair` is deployment-target neutral. It can run locally during development and can later be enhanced for Agent Runtime, Cloud Run, GKE, Fly.io, or another container host.

## Local Runtime

Start the Decision MCP backend:

```bash
cd servers/decision
PORT=3013 pnpm start
```

Run the agent package checks:

```bash
cd agents/investment-chair
uv sync
DECISION_MCP_URL=http://localhost:3013 uv run pytest
```

## Hosted Runtime

For a hosted deployment:

1. Deploy or configure a Decision-compatible MCP backend.
2. Set `DECISION_MCP_URL` to that backend URL.
3. Configure model credentials for the ADK runtime.
4. Configure secrets outside source control.
5. Configure audit logging and redaction for investment data.
6. Configure HITL review for approvals and sensitive memory promotion.
7. Run pytest and evals before promoting.

## Secrets And Sensitive Data

Do not commit API keys, model credentials, bid limits, IC materials, seller names, counterparty terms, legal/title findings, reserves data, financing terms, conflicts, or portfolio strategy. Prefer managed secret storage in hosted environments.

## Production Gate

Do not deploy or expose the agent as an approval authority. Production callers must present Investment Chair output as advisory support and route high-consequence actions to qualified human reviewers.
