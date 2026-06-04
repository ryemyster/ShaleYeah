# Architecture — @shaleyeah/server-drilling

## Role

Tier 1 MCP tool server. Designs drilling programs, optimizes well trajectories, and estimates drilling costs.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `design_drilling_program` | ✅ `callLLM` | Well type, depth, completion strategy, cost estimate |

## LLM pattern

Takes well parameters (type, target depth, formation) and calls `callLLM()` to produce a drilling program recommendation. Deterministic risk classification first: deep horizontal wells are classified "High" program risk before the LLM call.

## Key exports

`deriveDefaultDrillingInterpretation(wellType, depth, formation)` — deterministic fallback.

## Dependencies

```
@shaleyeah/server-drilling
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
