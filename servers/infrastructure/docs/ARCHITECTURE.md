# Architecture — @shaleyeah/server-infrastructure

## Role

Tier 1 MCP tool server. Assesses midstream infrastructure needs — pipelines, processing, takeaway capacity. Paired with the `infrastructure-planner` agent (port 4012).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `plan_infrastructure` | LLM | ✅ `callLLM` | Takeaway capacity, facility sizing, cost estimate |

## LLM + fallback pattern

Passes well count, production rate, and location to `callLLM()`. Falls back to `deriveDefaultInfrastructureInterpretation()` — remote large projects produce "High" takeaway risk; Texas small projects produce "Low".

## Key exports

`deriveDefaultInfrastructureInterpretation(wellCount, productionRate, location)` — deterministic fallback, exported for anti-stub testing.

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3012`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: plan_infrastructure { wellCount, productionRate, location }
  → callLLM(infrastructure planning prompt)
  ↘ fallback: deriveDefaultInfrastructureInterpretation(wellCount, productionRate, location)
  → Return: { takeawayCapacity, facilitySizing, costEstimate, riskLevel }
```

## Dependencies

```
@shaleyeah/server-infrastructure
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
