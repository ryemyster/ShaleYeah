# Architecture — @shaleyeah/server-development

## Role

Tier 1 MCP tool server. Creates development plans and monitors project execution for O&G properties. Paired with the `development-planner` agent (port 4011).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `create_development_plan` | LLM | ✅ `callLLM` | Well count, spacing, budget, schedule, risk assessment |
| `monitor_development_progress` | LLM | ✅ `callLLM` | Schedule / budget / safety metrics against plan |

## LLM + fallback pattern

Both tools call `callLLM()` for synthesis. Falls back to `deriveDefaultDevelopmentOutlook()` if the API is unavailable — tight budgets with many wells produce "High" budget risk; funded small projects produce "Low".

## Key exports

`deriveDefaultDevelopmentOutlook(wellCount, budget, risks)` — deterministic fallback, exported for anti-stub testing.

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3011`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: create_development_plan { wellCount, acreage, targetFormation, budget }
  → callLLM(development plan prompt)
  ↘ fallback: deriveDefaultDevelopmentOutlook(wellCount, budget, risks)
  → Return: { wells, spacing, budget, schedule, riskLevel }
```

## Dependencies

```
@shaleyeah/server-development
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
