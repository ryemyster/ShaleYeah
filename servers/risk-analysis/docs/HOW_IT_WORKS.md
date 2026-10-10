# How Risk-Analysis Works — @shaleyeah/server-risk-analysis

## Plain language (12-year-old version)

Before you spend $10 million drilling a well, you want to know: what could go wrong? Risk-Analysis is the expert who thinks through all the ways things could go bad — is the geology uncertain? Are prices volatile? Are there legal issues? Is the location in a tough regulatory state?

It scores each risk area (low/medium/high), then runs a thousand imaginary futures using Monte Carlo simulation to show you the range of outcomes — best case, most likely case, worst case.

## Technical explanation

Risk-Analysis is a **Tier 1 MCP tool server** — stateless, no session memory. It exposes 2 risk tools.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `assess_investment_risk` | Multi-domain risk scoring: geological, economic, legal, market, regulatory |
| `monte_carlo_simulation` | Runs N iterations varying oil price, production, and cost assumptions; returns P10/P50/P90 NPV distribution |

### Monte Carlo approach

The three samplers are intentional random functions (the only legitimate randomness in the codebase):
- `sampleUniform(min, max)` — uniform distribution
- `sampleTriangular(min, mode, max)` — triangular distribution (most common for O&G uncertainty)
- `sampleNormal(mean, std)` — normal distribution

Each simulation run varies oil price, production rate, and capital costs across their uncertainty ranges, computes NPV, and builds a distribution.

### LLM synthesis

`callLLM()` is called to interpret the risk factors in context and produce a narrative recommendation. The response is validated against `RiskProfileSchema` from `@shaleyeah/sdk`.

```typescript
const rawResponse = await callLLM({ prompt: riskPrompt });
const riskProfile = RiskProfileSchema.parse(JSON.parse(rawResponse));
```

### Transport modes

- **stdio** (default): pipe-based
- **HTTP** (when `PORT=3005`): `StreamableHTTPServerTransport` — used by the risk-analyst agent
