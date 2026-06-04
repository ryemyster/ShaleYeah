# Architecture — @shaleyeah/server-infrastructure

## Role

Tier 1 MCP tool server. Assesses midstream infrastructure needs — pipelines, processing, takeaway capacity.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `plan_infrastructure` | ✅ `callLLM` | Takeaway capacity, facility sizing, cost estimate |

## Key exports

`deriveDefaultInfrastructureInterpretation(wellCount, productionRate, location)` — deterministic fallback. Remote large projects produce "High" takeaway risk; Texas small projects produce "Low".

## Dependencies

```
@shaleyeah/server-infrastructure
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
