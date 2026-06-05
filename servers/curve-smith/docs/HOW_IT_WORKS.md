# How Curve-Smith Works — @shaleyeah/server-curve-smith

## Plain language (12-year-old version)

When an oil well is drilled, it produces a lot at first, then slows down over time — kind of like a soda fizzing out. Curve-Smith is the math expert that fits a curve to that "fizzing out" pattern. It figures out: how fast is production declining, when will it stop being economic, and how much total oil/gas will this well ever produce (that's the EUR — Estimated Ultimate Recovery).

You give it a list of monthly production numbers. It runs the math, then asks Claude to explain what the curve means and how confident we should be in the estimate.

## Technical explanation

Curve-Smith is a **Tier 1 MCP tool server** — stateless, no session memory. It exposes 4 reservoir engineering tools.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `analyze_decline_curve` | Fits exponential or hyperbolic Arps decline to oil + gas production history |
| `generate_type_curve` | Builds a normalized type curve from multiple analog wells |
| `calculate_eur` | Integrates the decline curve to compute total estimated ultimate recovery |
| `assess_curve_quality` | Grades R², data completeness, and fit reliability |

### Request lifecycle

```
Agent (reservoir-engineer)
  → MCP tool call: analyze_decline_curve { productionData, curveType }
      ↓
  Curve-Smith (src/index.ts)
      ↓
  1. fitDeclineCurve(productionData, "oil", curveType)   → src/tools/decline-curve-analysis.ts
  2. fitDeclineCurve(productionData, "gas", curveType)   → src/tools/decline-curve-analysis.ts
  3. callLLM(prompt with Arps parameters + EUR estimate) → interpretation
     OR fallback: return raw curve parameters without LLM framing
  4. Return: { oilCurve, gasCurve, EUR, interpretation, confidence }
```

### Arps decline math

The local `decline-curve-analysis.ts` handles all the math:
- **Exponential**: `q(t) = qi × e^(-Di×t)` — simple, no `b` parameter
- **Hyperbolic**: `q(t) = qi × (1 + b×Di×t)^(-1/b)` — most common for unconventional

No LLM is involved in the curve fitting math — Claude only interprets the results.

### Transport modes

- **stdio** (default): pipe-based
- **HTTP** (when `PORT=3004`): `StreamableHTTPServerTransport` — used by the reservoir-engineer agent
