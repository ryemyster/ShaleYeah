# Architecture - Market Analyst ADK Agent

Market Analyst is a Tier 2 ADK/Python package. It owns agent reasoning, tool-selection policy, eval coverage, and human-review boundaries for market diligence.

The Tier 1 execution backend remains [`servers/market`](../../../servers/market), which is still a TypeScript MCP server. That split is intentional: agents migrate to ADK/Python, servers stay small MCP services.

## Package Boundary

```text
agents/market-analyst/
  agents-cli-manifest.yaml   ADK project marker
  .agents-cli-spec.md        reference-pair spec and migration notes
  pyproject.toml             Python package and test dependencies
  app/agent.py               ADK root agent
  app/market_mcp.py          Python MCP client wrappers
  tests/                     pytest shape tests and eval references
```

No `package.json`, `tsconfig.json`, `biome.json`, `src/`, or TypeScript-only agent tests should exist in this package. If one appears under `agents/market-analyst`, it is dangling migration debt unless an issue explicitly scopes its deletion.

## Execution Flow

1. ADK receives a market analysis task through `app/agent.py`.
2. The agent plans the correct Market backend tool and checks review boundaries.
3. `app/market_mcp.py` calls the Market MCP server through streamable HTTP.
4. `servers/market` performs the domain operation and returns MCP content.
5. The ADK agent summarizes the result without approving final bid or investment decisions.

## Current Tool Parity

| ADK tool | Backend MCP tool | Purpose |
|----------|------------------|---------|
| `analyze_market_conditions` | `analyze_market_conditions` | Commodity market, pricing, and supply-demand context |
| `competitive_market_analysis` | `competitive_analysis` | Competitive landscape and operator comparison |

## Runtime Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `MARKET_MCP_URL` | `http://localhost:3007` | Market MCP backend URL |
| `MARKET_ANALYST_ADK_MODEL` | `gemini-flash-latest` | Local ADK model id |

## Safety Boundary

Market Analyst may analyze market conditions, competitor context, pricing signals, and uncertainty. It must not present final bid approval, investment approval, or acquisition authorization without human review.
