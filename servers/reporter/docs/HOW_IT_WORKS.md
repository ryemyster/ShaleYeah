# How Reporter Works — @shaleyeah/server-reporter

## Plain language (12-year-old version)

After a dozen domain experts have each done their job — geologist checked the rocks, economist ran the numbers, legal reviewed the contracts — someone has to take all that work and write a clear, readable report for the investment committee. That's the Reporter.

You give it all the analysis results and tell it who the audience is. It asks Claude to weave everything together into a professional narrative that tells the story of the deal: what we found, what we recommend, and why.

## Technical explanation

Reporter is a **Tier 1 MCP tool server** — stateless. It's the final synthesis layer in the deal workflow, turning structured agent outputs into human-readable investment documents.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `synthesize_analysis` | Combine outputs from multiple domain agents into one coherent analysis |
| `generate_investment_decision` | Produce a go/no-go recommendation with structured rationale |
| `create_executive_report` | Render a full executive summary for deal team or investment committee |

### Request lifecycle

```
Agent (reporter-agent)
  → MCP tool call: create_executive_report { dealName, sections, audience }
      ↓
  Reporter server (src/index.ts)
      ↓
  1. callLLM(synthesis prompt with all domain data)
     OR fallback: deterministic default
  2. Return: structured executive report
```

### Report flow in the fleet

Reporter is typically called last — after all 12 domain servers have run. The reporter-agent collects those outputs and sends them to this server for final synthesis.

### Transport modes

- **stdio** (default): pipe-based
- **HTTP** (when `PORT=3009`): `StreamableHTTPServerTransport` — used by the reporter-agent
