# Architecture — @shaleyeah/server-development

## Role

Tier 1 MCP tool server. Creates development plans and monitors project execution for O&G properties.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `create_development_plan` | ✅ `callLLM` | Well count, spacing, budget, schedule, risk assessment |
| `monitor_development_progress` | ✅ `callLLM` | Schedule / budget / safety metrics against plan |

## Key exports

`deriveDefaultDevelopmentOutlook(wellCount, budget, risks)` — deterministic fallback. Tight budgets with many wells produce "High" budget risk; funded small projects produce "Low".

## Dependencies

```
@shaleyeah/server-development
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
