# How Infrastructure Works — @shaleyeah/server-infrastructure

## Plain language (12-year-old version)

Oil and gas doesn't do any good if you can't get it out of the ground and to a buyer. That requires pipelines, processing facilities, and takeaway capacity. In a crowded basin, those might already be there — in a new remote area, you might need to build everything yourself, which costs a fortune.

Infrastructure is like the logistics expert on the deal team. You tell it how many wells you're planning, how much they'll produce, and where they are. It figures out what existing pipeline and processing infrastructure is nearby, whether the takeaway capacity exists, what it'll cost to connect, and how big a risk that creates for your investment.

## Technical explanation

Infrastructure is a **Tier 1 MCP tool server** — stateless. It exposes 1 midstream planning tool backed by LLM synthesis.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `plan_infrastructure` | Takeaway capacity assessment, facility sizing, cost estimate, risk level |

### Request lifecycle

```
Agent (infrastructure-planner)
  → MCP tool call: plan_infrastructure { wellCount, productionRate, location }
      ↓
  Infrastructure server (src/index.ts)
      ↓
  1. callLLM(infrastructure planning prompt)
     OR fallback: deriveDefaultInfrastructureInterpretation(wellCount, productionRate, location)
  2. Return: { takeawayCapacity, facilitySizing, costEstimate, riskLevel }
```

### Fallback logic

`deriveDefaultInfrastructureInterpretation()` is deterministic:
- Remote location + large wellCount → "High" takeaway risk
- Texas + small wellCount (≤3) → "Low" takeaway risk

### Transport modes

- **stdio** (default): pipe-based
- **HTTP** (when `PORT=3012`): `StreamableHTTPServerTransport` — used by the infrastructure-planner agent
