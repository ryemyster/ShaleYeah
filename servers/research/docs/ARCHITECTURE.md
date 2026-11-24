# Architecture — Research MCP Server

`servers/research` is the TypeScript MCP backend for oil and gas market intelligence and competitive analysis. It is independent from the ADK agent in `agents/research-analyst`.

## Responsibilities

This server owns executable tool contracts, argument validation, source fetching or adapter invocation, deterministic fallbacks, and optional LLM synthesis for:

| Tool | Purpose |
|------|---------|
| `conduct_market_research` | Gather and synthesize market, commodity, policy, technology, or source-specific research |
| `analyze_competition` | Analyze regional operator or competitor activity, strategy, performance, and threat level |

The agent owns natural-language reasoning, source-quality judgment, tool choice, evals, and HITL deferral. The server does not approve investments, disclosures, reserve classifications, legal conclusions, or memory promotion.

## Runtime Flow

```text
agents/research-analyst
Python ADK agent
        |
        | Streamable HTTP MCP
        v
servers/research
TypeScript MCP server on PORT=3008
```

## Transport Modes

- stdio when `PORT` is not set.
- HTTP with `StreamableHTTPServerTransport` when `PORT=3008`.

## Key Modules

- `src/index.ts` registers MCP tools.
- `src/tools/market-research.ts` derives market-research output and optional LLM synthesis.
- `src/tools/competitive-analysis.ts` derives competitor analysis and optional LLM synthesis.
- `src/tools/web-fetch.ts` fetches approved source URLs and returns text extraction output.
