# Architecture

## Role

`servers/infrastructure` is the TypeScript MCP backend for surface and midstream infrastructure analysis. It is independently runnable and can be used by the Infrastructure Planner ADK agent or another compatible MCP client.

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `plan_pipeline` | pipeline module | yes, with fallback | Gathering/transmission routing, capacity, takeaway risk |
| `size_facilities` | facilities module | yes, with fallback | Batteries, separators, compressors, SWD wells |
| `estimate_costs` | cost-estimation module | yes, with fallback | Pipeline, facility, compression, and SWD CAPEX |
| `assess_compliance` | compliance module | yes, with fallback | Permits, approval timeline, environmental risk |

## LLM + fallback pattern

Each tool uses shared `callLLM()` synthesis with deterministic fallback functions exported from the server modules.

## Key exports

`derivePipelinePlan`, `deriveFacilitySizing`, `deriveInfrastructureCostEstimate`, and `deriveComplianceAssessment` are deterministic fallbacks exported for tests and CI-safe behavior.

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3012`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: plan_pipeline | size_facilities | estimate_costs | assess_compliance
  → callLLM(domain-specific infrastructure prompt)
  ↘ fallback: deterministic domain module
  → Return: structured pipeline, facility, cost, or compliance result
```

## Dependencies

```
@shaleyeah/server-infrastructure
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
