# How It Works

The Investment Chair is a thin ADK agent over the Decision MCP backend.

1. The user asks for investment decision, bid strategy, or portfolio-fit support.
2. `app/agent.py` exposes lightweight planning and status tools so the model can identify the correct backend capability.
3. `app/decision_mcp.py` maps Python arguments to the exact `servers/decision` MCP contract.
4. The Decision MCP server returns structured analysis.
5. The agent explains the advisory result, assumptions, missing inputs, risks, data-vintage limits, and required human-review steps.

## Tool Selection

| User intent | ADK wrapper | Decision MCP tool |
|-------------|-------------|-------------------|
| Investment recommendation, go/no-go, IC memo | `make_investment_decision` | `make_investment_decision` |
| Bid range, auction posture, valuation strategy | `calculate_bid_strategy` | `calculate_bid_strategy` |
| Portfolio fit, concentration, diversification, synergies, conflicts | `analyze_portfolio_fit` | `analyze_portfolio_fit` |

The agent also exposes `decision_backend_status` and `plan_decision_tool_call` for runtime inspection and architecture/HITL markers.

## Required Context

Useful inputs include geology, engineering, economics, risk, title, legal, market, infrastructure, drilling, development, research, portfolio, financing, governance, and comparable-sales context.

When inputs are sparse or stale, the correct behavior is to say what is missing and produce only a provisional checklist or advisory framing. The agent should not invent confidence, source support, reserves classifications, or approval authority.

## Sensitive Data

Treat bid limits, valuation models, IC materials, seller names, counterparty terms, legal/title findings, reserves data, financing terms, conflicts, portfolio strategy, and secrets as sensitive. Do not place them in prompts, logs, checked-in config, or shared memory unless the runtime has an approved storage and review path.
