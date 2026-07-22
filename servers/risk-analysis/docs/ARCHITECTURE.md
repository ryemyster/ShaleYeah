# Architecture — @shaleyeah/server-risk-analysis

## Role

Tier 1 MCP tool server. Scores investment risk and runs Monte Carlo simulations across geological, economic, legal, and market domains. Paired with the `risk-analyst` agent (port 4005).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `assess_investment_risk` | `callLLM()` | ✅ `callLLM` | Risk scoring: geological, economic, legal, market, regulatory |
| `monte_carlo_simulation` | `sampleUniform/Triangular/Normal()` | ✅ `callLLM` | Monte Carlo NPV distribution with P10/P50/P90 |

## Monte Carlo samplers

`sampleUniform()`, `sampleTriangular()`, `sampleNormal()` in `src/index.ts` are intentional Monte Carlo samplers — the only legitimate uses of randomness in the codebase. These are named explicitly to distinguish from accidental `Math.random()` stubs.

## LLM + fallback pattern

Constructs a multi-domain risk prompt (geological confidence, NPV, IRR, location, project type), calls `callLLM()` once, validates response against `RiskProfileSchema`, `EconomicsSchema`, and `FormationSchema` from `@shaleyeah/sdk`.

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3005`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: assess_investment_risk { location, projectType, npv, irr, ... }
  → callLLM(multi-domain risk prompt)
    → RiskProfileSchema.parse(response)
  ↘ fallback: deterministic risk rules by location/project type
```

## Dependencies

```
@shaleyeah/server-risk-analysis
  └── @shaleyeah/sdk   (MCPServer, callLLM, EconomicsSchema, FormationSchema, RiskProfileSchema)
```
