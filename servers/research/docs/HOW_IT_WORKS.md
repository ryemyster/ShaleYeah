# How Research Works

The Research server gives callers structured tools for gathering and synthesizing oil and gas market intelligence.

The ADK agent decides what the user is asking for. This server executes the requested MCP tool and returns structured output.

## Tools

| Tool | What it does |
|------|--------------|
| `conduct_market_research` | Builds a research summary with source references, findings, competitive intelligence, trends, forecasts, confidence, and recommendations |
| `analyze_competition` | Builds operator or competitor entries with activities, strategy, threat level, and data-source metadata |

## Request Lifecycle

```text
MCP caller
  -> tool name plus JSON arguments
  -> validation in src/index.ts
  -> domain helper in src/tools/
  -> source fetches or deterministic fallback inputs
  -> optional callLLM synthesis
  -> deterministic fallback if LLM is unavailable
  -> structured MCP response
```

## Fallback Behavior

Fallbacks are deterministic. They should return useful intelligence scaffolding without pretending to have verified live market data. If the user needs final approvals, current disclosure authority, reserves language, or verified proprietary-source claims, the ADK agent must defer to human review.
