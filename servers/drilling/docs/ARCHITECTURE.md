# Architecture — @shaleyeah/server-drilling

## Role

Tier 1 MCP tool server. Designs drilling programs, estimates well costs, and assesses drilling risks. Paired with the ADK/Python Drilling Engineer agent in `agents/drilling-engineer`.

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `design_drilling_program` | `synthesizeDrillingProgramWithLLM()` | yes, with deterministic fallback | Program risk, casing, mud, completion type, and recommendation |
| `estimate_well_costs` | `synthesizeWellCostsWithLLM()` | yes, with deterministic fallback | Drilling, completion, facilities, total cost, cost/ft, and estimated days |
| `assess_drilling_risks` | `synthesizeDrillingRisksWithLLM()` | yes, with deterministic fallback | Geological, operational, environmental, and overall risk with mitigations |

## LLM + fallback pattern

Computes deterministic drilling outputs from well parameters, then calls `callLLM()` for Perforator Maximus synthesis. Each tool falls back to deterministic domain logic if the API is unavailable.

```typescript
const program = await synthesizeDrillingProgramWithLLM(params);
// Falls back to:
const program = deriveDrillingProgram(wellType, targetDepth, formation);
```

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3003`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call
  → design_drilling_program | estimate_well_costs | assess_drilling_risks
  → Normalize formation identifier
  → synthesize...WithLLM(params) → callLLM()
  ↘ fallback: derive...()
  → Return structured MCP result with confidence
```

## Key exports

`deriveDrillingProgram(wellType, depth, formation)` — exported, used by tests.
`deriveWellCostBreakdown(wellType, depth)` — exported, used by tests.
`deriveDrillingRiskProfile(wellType, depth, formation, environmentalConstraints)` — exported, used by tests.
`synthesize...WithLLM(params)` functions — exported, used by anti-stub tests.

## Dependencies

```
@shaleyeah/server-drilling
  └── @shaleyeah/sdk   (MCPServer, callLLM, ServerFactory)
```
