# How Research Works — @shaleyeah/server-research

## Plain language (12-year-old version)

Before you invest in a basin, it helps to know what's happening there — who's drilling, what the industry is saying, what the analysts think. Research is like having an expert who can quickly browse the web, read articles about the oil and gas market, and summarize what's relevant for your investment decision.

You tell it what topic and region you care about. It fetches relevant content, then asks Claude to synthesize the key findings into a structured research summary.

## Technical explanation

Research is a **Tier 1 MCP tool server** — stateless. It exposes 2 market intelligence tools backed by web fetching.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `conduct_market_research` | Fetches web content about a topic + region, synthesizes into market summary |
| `analyze_competition` | Profiles competitor activity and strategic positioning in a basin |

### Request lifecycle

```
Agent (research-analyst)
  → MCP tool call: conduct_market_research { topic, region, scope }
      ↓
  Research server (src/index.ts)
      ↓
  1. fetchUrl(relevant URLs)     → src/tools/web-fetch.ts
  2. callLLM(synthesis prompt with raw content)
     OR fallback: deriveDefaultResearchSummary()
  3. Return: structured research summary
```

### Web fetch pattern

`web-fetch.ts` is a thin HTTP wrapper — it fetches URLs and returns raw content. No LLM inside. The synthesis happens in the tool handler.

### Transport modes

- **stdio** (default): pipe-based
- **HTTP** (when `PORT=3008`): `StreamableHTTPServerTransport` — used by the research-analyst agent
