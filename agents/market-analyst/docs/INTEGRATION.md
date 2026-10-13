# Integration Guide - Market Analyst ADK Agent

Integrate Market Analyst through its ADK package.

## Local ADK Invocation

```bash
cd agents/market-analyst
MARKET_MCP_URL=http://localhost:3007/mcp MARKET_MCP_ACCESS_TOKEN_FILE=/path/to/private/mcp-token agents-cli run \
  "Analyze current oil and gas market conditions for the Permian over a 1 year timeframe"
```

## Backend Contract

The ADK tools map to the current Market MCP server tools:

| ADK wrapper | MCP tool |
|-------------|----------|
| `analyze_market_conditions` | `analyze_market_conditions` |
| `competitive_market_analysis` | `competitive_analysis` |

The MCP backend URL comes from `MARKET_MCP_URL`. The default is `http://localhost:3007/mcp`.

## Orchestration Boundary

An orchestrator may call the ADK app as a standalone agent unit. It should not import internal Python functions as shared library APIs or recreate a TypeScript agent adapter. Shared contracts belong in `sdk/`; Market execution stays behind `servers/market`.

## Human Review

Downstream systems must treat final bid approval, investment approval, and acquisition authorization as human-review actions. Market Analyst can provide supporting analysis only.

## Connection profile

This caller uses MCP 2026-07-28 with self-contained requests, fresh tool discovery and validated results. Set the private credential-file reference shown above; model keys and MCP credentials serve different purposes. The backend must configure permitted identities/scopes and required audit before opening HTTP. Old initialized servers are outside this selected profile. Keep caller credentials separate from any model or third-party source credentials.
