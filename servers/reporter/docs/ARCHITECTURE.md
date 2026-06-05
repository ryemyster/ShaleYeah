# Architecture — @shaleyeah/server-reporter

## Role

Tier 1 MCP tool server. Generates professional investment reports and executive summaries from structured analysis inputs. Paired with the `reporter-agent` agent (port 4009).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `synthesize_analysis` | LLM | ✅ `callLLM` | Combine outputs from multiple domain agents into cohesive analysis |
| `generate_investment_decision` | LLM | ✅ `callLLM` | One-page go/no-go decision memo with rationale |
| `create_executive_report` | LLM | ✅ `callLLM` | Full executive report with appendices |

## LLM + fallback pattern

Takes structured analysis results from other servers as input, calls `callLLM()` to synthesize into prose, returns markdown-formatted reports. All formatting and structure decisions are in the prompt. Falls back to deterministic defaults if the API is unavailable.

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3009`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: create_executive_report { dealName, sections, audience }
  → callLLM(prompt with all gathered domain data)
  ↘ fallback: deterministic default
  → Return: markdown-formatted executive report
```

## Dependencies

```
@shaleyeah/server-reporter
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
