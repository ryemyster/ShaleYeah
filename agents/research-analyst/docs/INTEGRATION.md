# Integration

Integrate with the Research Analyst as an ADK app. Integrate with `servers/research` when you need deterministic MCP tool execution without agent reasoning.

## Agent Entry Point

The ADK entry point is:

```text
agents/research-analyst/app/agent.py
```

It exports:

- `root_agent`
- `app`
- `research_backend_status`
- `plan_research_tool_call`

The MCP wrappers live in:

```text
agents/research-analyst/app/research_mcp.py
```

## Backend Contract

The agent calls these MCP tools through Streamable HTTP:

- `conduct_market_research`
- `analyze_competition`

Set `RESEARCH_MCP_URL` when the backend is not running at `http://localhost:3008/mcp`.

## Upstream And Downstream Context

Common upstream inputs:

- user-provided source URLs or excerpts
- EIA, SEC EDGAR, state regulator, BLM, FERC, SPE/PRMS, operator, or subscription-source material
- basin, operator, commodity, regulatory, technology, and timeframe scope

Common downstream consumers:

- Investment Chair
- Risk Analyst
- Market Analyst
- Economist
- Reporter
- Legal and Title agents
- Development Planner
- Infrastructure, Drilling, and Reservoir specialists

The agent can summarize dependencies and source gaps, but it should not claim facts unless they were provided or fetched through approved tools.

## Connection profile

This caller uses MCP 2026-07-28 with self-contained requests, fresh tool discovery and validated results. Set the private credential-file reference shown above; model keys and MCP credentials serve different purposes. The backend must configure permitted identities/scopes and required audit before opening HTTP. Old initialized servers are outside this selected profile. Keep caller credentials separate from any model or third-party source credentials.
