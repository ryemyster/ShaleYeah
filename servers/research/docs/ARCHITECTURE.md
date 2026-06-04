# Architecture — @shaleyeah/server-research

## Role

Tier 1 MCP tool server. Fetches and synthesizes web-based market intelligence, competitive analysis, and industry research.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `conduct_market_research` | ✅ `callLLM` | Market trends, pricing outlook, supply/demand |
| `analyze_competition` | ✅ `callLLM` | Competitor activity and positioning in a basin |

## Local tool (src/tools/)

`web-fetch.ts` — HTTP fetch wrapper. `fetchUrl(url)` returns typed `FetchResult` with raw content. No LLM calls inside.

## LLM pattern

Handlers call `fetchUrl()` to retrieve raw content, then pass it to `callLLM()` for synthesis and structured extraction.

## Key exports

`deriveDefaultResearchSummary()` and `deriveDefaultCompetitorEntry()` are exported pure functions — deterministic fallbacks and anti-stub test targets.

## Dependencies

```
@shaleyeah/server-research
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
