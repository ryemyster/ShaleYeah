# Architecture — @shaleyeah/server-research

## Role

Tier 1 MCP tool server. Fetches and synthesizes web-based market intelligence, competitive analysis, and industry research. Paired with the `research-analyst` agent (port 4008).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `conduct_market_research` | `fetchUrl()` + LLM | ✅ `callLLM` | Market trends, pricing outlook, supply/demand synthesis |
| `analyze_competition` | `fetchUrl()` + LLM | ✅ `callLLM` | Competitor activity and positioning in a basin |

## Local tool (src/tools/)

`web-fetch.ts` — HTTP fetch wrapper. `fetchUrl(url)` returns typed `FetchResult` with raw content. No LLM calls inside.

## LLM + fallback pattern

Handlers call `fetchUrl()` to retrieve raw content, then pass it to `callLLM()` for synthesis. Falls back to `deriveDefaultResearchSummary()` and `deriveDefaultCompetitorEntry()` if the API is unavailable.

## Key exports

`deriveDefaultResearchSummary()` and `deriveDefaultCompetitorEntry()` — exported pure functions, used in anti-stub tests.

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3008`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: conduct_market_research { topic, region, scope, timeframe }
  → fetchUrl(relevant URLs)            # web-fetch.ts
  → callLLM(prompt with raw content)
  ↘ fallback: deriveDefaultResearchSummary()
```

## Dependencies

```
@shaleyeah/server-research
  ├── @shaleyeah/sdk       (MCPServer, callLLM)
  └── src/tools/web-fetch  (HTTP fetch wrapper)
```
