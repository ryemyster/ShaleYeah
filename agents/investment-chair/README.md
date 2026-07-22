# Investment Chair

`agents/investment-chair` is the ADK/Python agent that helps prepare oil and gas investment decision support. It reads a user's decision, bid, or portfolio-fit request, chooses the right Decision MCP capability, and returns advisory diligence output with clear source limits and human-review gates.

The agent does not make final investment decisions. It supports a human investment committee, board, fund manager, officer, or authorized reviewer.

## What It Does

- Synthesizes upstream diligence into an advisory `INVEST`, `PASS`, or `CONDITIONAL` recommendation.
- Calculates advisory bid posture and bid range from valuation and market context.
- Assesses portfolio fit, concentration, diversification, synergies, and conflicts.
- Flags missing specialist diligence, stale data, unsupported assumptions, and material risks.
- Defers final approvals, binding transaction actions, capital release, disclosure claims, legal/tax/title/fiduciary conclusions, reserve/resource classification, and sensitive memory promotion.

## Package Boundary

| Layer | Package | Runtime |
|-------|---------|---------|
| Agent | `agents/investment-chair` | ADK/Python |
| MCP backend | `servers/decision` | TypeScript/pnpm MCP server |

`servers/decision` is independently runnable. The agent reaches it over MCP Streamable HTTP using `DECISION_MCP_URL`, defaulting to `http://localhost:3013`.

## Architecture Mode

Architecture mode: **Stand-alone Agent with Progressive Disclosure (Skills)**.

This package is not a hierarchical orchestrator, graph workflow, ambient event processor, or capability-first arbitrator. It is a stand-alone specialist that exposes a small ADK surface and loads the Decision MCP capabilities only when the user asks for decision synthesis, bid strategy, or portfolio-fit work.

## Run Locally

```bash
cd servers/decision
PORT=3013 pnpm start
```

```bash
cd agents/investment-chair
uv sync
DECISION_MCP_URL=http://localhost:3013 uv run pytest
```

For an interactive ADK run, use the agents-cli commands from this package directory after dependencies are installed:

```bash
agents-cli run "Assess whether this investment package should be invest, pass, or conditional."
```

## Test And Eval

```bash
cd agents/investment-chair
uv run pytest
agents-cli eval generate
agents-cli eval grade
```

Pytest verifies package shape, MCP wrapper contracts, eval harness shape, and cleanup of displaced TypeScript agent files. The eval dataset covers control, edge, and capability-boundary behavior.

## Deploy

This package is deployment-target neutral. It can run locally or be enhanced later for Agent Runtime, Cloud Run, GKE, Fly.io, or another container host. Keep the Decision MCP backend independently deployed and configure `DECISION_MCP_URL` for the target environment.

Do not deploy without separately reviewing secrets, auth, audit logging, memory policy, and HITL enforcement.

## Human Review Boundary

Human review is required before using output as final investment approval, a binding bid, LOI, PSA, term sheet, financing action, acquisition/divestiture authority, capital commitment, AFE/budget release, investment committee vote, board/officer/fund-manager approval, securities disclosure, reserve/resource classification, legal/tax/title/fiduciary/conflict conclusion, fairness or valuation opinion, final allocation decision, or shared-memory promotion of sensitive IC material.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
