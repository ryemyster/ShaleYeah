# Architecture

`agents/investment-chair` is a package-local ADK/Python project. It owns the Investment Chair prompt, ADK tool registration, Python MCP wrappers, eval cases, local tests, and human-review policy.

`servers/decision` remains the independent TypeScript MCP backend. It owns the executable tools:

- `make_investment_decision`
- `calculate_bid_strategy`
- `analyze_portfolio_fit`

## Runtime Shape

```text
Caller or ADK runner
        |
        v
agents/investment-chair
  app/agent.py
  app/decision_mcp.py
        |
        | MCP Streamable HTTP
        v
servers/decision
```

The default backend URL is `http://localhost:3013`. Set `DECISION_MCP_URL` to point the agent at a local, hosted, internal, or proprietary Decision-compatible MCP service.

## Architecture Mode

Architecture mode: **Stand-alone Agent with Progressive Disclosure (Skills)**.

The agent has one specialist role: turn investment-chair requests into the correct Decision MCP capability and synthesize the result as advisory diligence. It is not the fleet orchestrator. It should consume upstream specialist outputs when provided, but it does not spawn sub-agents or own their work.

Non-selected modes for this issue:

- **Hierarchical:** future work may add committee-support sub-workers, but #539 keeps one specialist agent.
- **Graph-based:** future work may add explicit approval gates, but #539 uses instruction and eval boundaries.
- **Ambient:** future work may monitor portfolio events, but #539 is request-driven.
- **Capability-first:** future work may route simple calculations to deterministic code first, but #539 keeps a direct ADK-to-MCP specialist pattern.

## Trust Boundary

The agent may prepare advisory diligence. It must not represent output as:

- final investment approval or rejection;
- investment committee, board, officer, or fund-manager vote;
- binding bid, LOI, PSA, term sheet, acquisition, divestiture, financing, or capital commitment;
- AFE or budget release;
- legal, tax, title, fiduciary, conflict, fairness, or valuation certification;
- securities disclosure approval;
- reserve or resource classification;
- approval to store sensitive IC material in shared memory.

Those actions require qualified human review outside this package.
