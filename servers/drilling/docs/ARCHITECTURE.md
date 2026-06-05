# Architecture — @shaleyeah/server-drilling

## Role

Tier 1 MCP tool server. Designs drilling programs, optimizes well trajectories, and estimates drilling costs. Paired with the `drilling-engineer` agent (port 4003).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `design_drilling_program` | `synthesizeDrillingAnalysisWithLLM()` | ✅ `callLLM` | Well program: trajectory, casing, cost estimate, risk assessment |

## LLM + fallback pattern

Computes deterministic cost/timeline estimates from well parameters, then calls `callLLM()` once for Perforator Maximus to interpret risks. Falls back to `deriveDefaultDrillingInterpretation()` if the API is unavailable.

```typescript
const interpretation = await synthesizeDrillingAnalysisWithLLM(params);
// Falls back to:
const interpretation = deriveDefaultDrillingInterpretation(wellType, targetDepth, formation);
```

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3003`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: design_drilling_program { wellParameters, location, constraints }
  → Compute deterministic cost (depth × rate factor by well type)
  → synthesizeDrillingAnalysisWithLLM(params) → callLLM()
  ↘ fallback: deriveDefaultDrillingInterpretation()
  → Return full drilling program JSON
```

## Key exports

`deriveDefaultDrillingInterpretation(wellType, depth, formation)` — exported, used by tests.
`synthesizeDrillingAnalysisWithLLM(params)` — exported, used by anti-stub tests.

## Dependencies

```
@shaleyeah/server-drilling
  └── @shaleyeah/sdk   (MCPServer, callLLM, ServerFactory)
```
