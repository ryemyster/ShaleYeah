# How Decision Works — @shaleyeah/server-decision

## Plain language (12-year-old version)

After every expert has weighed in — the geologist, the economist, the drilling engineer, the lawyer, everyone — someone has to sit at the head of the table and make the call: do we buy this property, and if so, how much do we bid?

Decision is that person. You give it all the expert reports: how confident is the geology, what's the NPV, what's the IRR, what are the risks. It synthesizes everything and tells you: go or no-go, why, and what you should bid.

## Technical explanation

Decision is a **Tier 1 MCP tool server** — stateless. It is the final synthesis layer in the investment workflow, turning all domain scores into a structured investment recommendation.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `make_investment_decision` | Go/no-go recommendation with rationale and confidence from full domain synthesis |
| `calculate_bid_strategy` | Recommended bid range, walk-away price, and negotiation strategy |
| `analyze_portfolio_fit` | Portfolio fit score and strategic rationale |

### Request lifecycle

```
Agent (investment-chair)
  → MCP tool call: make_investment_decision { geologicalConfidence, npv, irr, riskScore, ... }
      ↓
  Decision server (src/index.ts)
      ↓
  1. callLLM(decision prompt with all domain data)
  2. DecisionSchema (from @shaleyeah/sdk) validates structured output
     OR fallback: calculateRecommendedBid() + deterministic defaults
  3. Return: { decision, rationale, confidence, bidRange }
```

### DecisionSchema

Validated output from `@shaleyeah/sdk` — enforces that the LLM returns a properly structured investment decision rather than free-form text.

### Transport modes

- **stdio** (default): pipe-based
- **HTTP** (when `PORT=3013`): `StreamableHTTPServerTransport` — used by the investment-chair agent
