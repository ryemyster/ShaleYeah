# Architecture — @shaleyeah/server-curve-smith

## Role

Tier 1 MCP tool server. Fits Arps decline models to production history and computes EUR (Estimated Ultimate Recovery). Uses the local `decline-curve-analysis.ts` tool for the math.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `analyze_decline_curve` | ✅ `callLLM` | Fit exponential/hyperbolic Arps model to production data |
| `generate_type_curve` | ✅ `callLLM` | Build a basin-specific type curve from analog wells |
| `calculate_eur` | ✅ `callLLM` | EUR estimate from decline parameters |
| `assess_curve_quality` | ✅ `callLLM` | Grade the quality of the decline curve fit |

## Local tool (src/tools/)

`decline-curve-analysis.ts` — pure math: Arps exponential/hyperbolic curve fitting, EUR integration, `fitExponentialDecline()` / `fitHyperbolicDecline()`. No LLM calls inside this file.

## LLM pattern

Handlers call the local math first, then pass results to `callLLM()` for interpretation and recommendation framing.

## Dependencies

```
@shaleyeah/server-curve-smith
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
