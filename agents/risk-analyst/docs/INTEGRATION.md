# Integration — Risk Analyst ADK Agent

Integrate with Risk Analyst through the ADK project in `agents/risk-analyst`.

## Local ADK Invocation

```bash
cd agents/risk-analyst
RISK_ANALYSIS_MCP_URL=http://localhost:3005 agents-cli run \
  "Run a Monte Carlo simulation for price, production, decline, and capex uncertainty"
```

## Backend Contract

The agent calls the Risk Analysis-compatible MCP backend configured by `RISK_ANALYSIS_MCP_URL`.

| Backend tool | Agent wrapper |
|--------------|---------------|
| `assess_investment_risk` | `assess_investment_risk` |
| `monte_carlo_simulation` | `monte_carlo_simulation` |

## Orchestrator Boundary

Future orchestration should call the ADK agent as a standalone unit. Keep task routing, fleet learning loops, and deployment control plane work outside this package unless an issue explicitly scopes it here.

## Server Integration

Claude Desktop and other MCP clients can connect directly to `servers/risk-analysis` for Tier 1 tool access. The Tier 2 Risk Analyst behavior remains in ADK and uses the same backend URL.
