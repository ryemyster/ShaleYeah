# Architecture — @shaleyeah/server-reporter

## Role

Tier 1 MCP tool server. Generates professional investment reports and executive summaries from structured analysis inputs.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `generate_investment_decision` | ✅ `callLLM` | One-page go/no-go decision memo |
| `create_executive_report` | ✅ `callLLM` | Full executive report with appendices |

## LLM pattern

Takes structured analysis results from other servers as input, calls `callLLM()` to synthesize into prose, and returns markdown-formatted reports. All formatting and structure decisions are in the prompt.

## Dependencies

```
@shaleyeah/server-reporter
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
