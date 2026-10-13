# Architecture — @shaleyeah/server-curve-smith

## Role

Tier 1 MCP tool server. Fits Arps decline models to production history and computes EUR (Estimated Ultimate Recovery). Paired with the `reservoir-engineer` agent (port 4004).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `analyze_decline_curve` | `fitDeclineCurve()` + LLM | ✅ `callLLM` | Fit exponential/hyperbolic Arps model to production data |
| `generate_type_curve` | local math + LLM | ✅ `callLLM` | Build a basin-specific type curve from analog wells |
| `calculate_eur` | local math + LLM | ✅ `callLLM` | EUR estimate from decline parameters |
| `assess_curve_quality` | local math + LLM | ✅ `callLLM` | Grade quality of the decline curve fit |

## Local tool (src/tools/)

`decline-curve-analysis.ts` — pure math: Arps exponential/hyperbolic curve fitting, EUR integration, `fitExponentialDecline()` / `fitHyperbolicDecline()`. No LLM calls inside this file.

## LLM + fallback pattern

Handlers call the local math first (deterministic curve fitting), then pass results to `callLLM()` for interpretation and recommendation framing.

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3004`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: analyze_decline_curve { productionData, curveType }
  → fitDeclineCurve(productionData, "oil", curveType)  # local math
  → fitDeclineCurve(productionData, "gas", curveType)  # local math
  → callLLM(prompt with curve parameters) → interpretation
  ↘ fallback: rule-based quality grade
```

## Dependencies

```
@shaleyeah/server-curve-smith
  ├── @shaleyeah/sdk                    (MCPServer, callLLM)
  └── src/tools/decline-curve-analysis  (local Arps math)
```
