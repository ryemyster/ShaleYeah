# Integration Guide - Market Analyst ADK Agent

Integrate Market Analyst through its ADK package, not through a TypeScript agent adapter.

## Local ADK Invocation

```bash
cd agents/market-analyst
MARKET_MCP_URL=http://localhost:3007 agents-cli run \
  "Analyze current oil and gas market conditions for the Permian over a 1 year timeframe"
```

## Backend Contract

The ADK tools map to the current Market MCP server tools:

| ADK wrapper | MCP tool |
|-------------|----------|
| `analyze_market_conditions` | `analyze_market_conditions` |
| `competitive_market_analysis` | `competitive_analysis` |

The MCP backend URL comes from `MARKET_MCP_URL`. The default is `http://localhost:3007`.

## Orchestration Boundary

An orchestrator may call the ADK app as a standalone agent unit. It should not import internal Python functions as shared library APIs or recreate a TypeScript agent adapter. Shared contracts belong in `sdk/`; Market execution stays behind `servers/market`.

## Human Review

Downstream systems must treat final bid approval, investment approval, and acquisition authorization as human-review actions. Market Analyst can provide supporting analysis only.
