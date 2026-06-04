# Architecture — @shaleyeah/server-risk-analysis

## Role

Tier 1 MCP tool server. Scores investment risk, runs Monte Carlo simulations, and identifies mitigation strategies.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `assess_investment_risk` | ✅ `callLLM` | Risk scoring across geological, economic, legal, market domains |

## Monte Carlo

`sampleUniform()`, `sampleTriangular()`, `sampleNormal()` in `src/index.ts` are intentional Monte Carlo samplers — the only legitimate uses of random in the codebase (named explicitly to distinguish from `Math.random()` stubs).

## Key imports from sdk

Uses `EconomicsSchema`, `FormationSchema`, and `RiskProfileSchema` from `@shaleyeah/sdk` to validate structured sections of the LLM output.

## LLM pattern

Constructs a multi-domain risk prompt, calls `callLLM()` once, validates the response against Zod schemas.

## Dependencies

```
@shaleyeah/server-risk-analysis
  └── @shaleyeah/sdk   (MCPServer, callLLM, EconomicsSchema, FormationSchema, RiskProfileSchema)
```
