# Integration

The Investment Chair integrates with Decision-compatible MCP backends over Streamable HTTP.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `DECISION_MCP_URL` | `http://localhost:3013` | Decision MCP backend URL |
| `INVESTMENT_CHAIR_ADK_MODEL` | `gemini-flash-latest` | ADK model for the agent |

## Decision Contract

`app/decision_mcp.py` maps Python calls to the current Decision MCP schemas:

- `make_investment_decision(analysis_inputs, investment_criteria=None, market_conditions=None, output_path=None)`
- `calculate_bid_strategy(valuation, market_data=None, strategy="CONSERVATIVE", output_path=None)`
- `analyze_portfolio_fit(opportunity, current_portfolio=None, portfolio_strategy=None, match_threshold=None)`

The Python wrapper intentionally uses the Decision server's current names: `analysisInputs`, `investmentCriteria`, `marketConditions`, `valuation`, `marketData`, `strategy`, `opportunity`, `currentPortfolio`, `portfolioStrategy`, and `matchThreshold`.

## Upstream Inputs

Callers can provide outputs from geology, engineering, economics, risk, title, legal, market, research, drilling, development, infrastructure, and QA packages as structured context. The Investment Chair does not require those agents to be colocated; it only needs the user or orchestrator to supply their diligence outputs.

## Compatible MCP Backends

Any internal or third-party MCP backend can replace `servers/decision` if it implements the same tool contract and trust boundary. The agent should not assume a particular deployment platform, hostname, or vendor.

## Human Review

Integrators must enforce review before final approvals, binding bids, transaction documents, capital release, disclosures, legal/tax/title/fiduciary/conflict conclusions, reserve/resource classifications, final allocation decisions, or sensitive memory promotion.
