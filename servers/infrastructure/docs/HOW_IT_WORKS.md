# How Infrastructure Works

## Plain language (12-year-old version)

Oil and gas doesn't do any good if you can't get it out of the ground and to a buyer. That requires pipelines, processing facilities, and takeaway capacity. In a crowded basin, those might already be there — in a new remote area, you might need to build everything yourself, which costs a fortune.

Infrastructure is like the logistics expert on the deal team. You tell it how many wells you're planning, how much they'll produce, and where they are. It figures out what existing pipeline and processing infrastructure is nearby, whether the takeaway capacity exists, what it'll cost to connect, and how big a risk that creates for your investment.

## Technical explanation

Infrastructure is a stateless MCP tool server. It exposes four focused midstream and surface-infrastructure tools backed by LLM synthesis and deterministic fallbacks.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `plan_pipeline` | Gathering/transmission routing, capacity, and takeaway risk |
| `size_facilities` | Tank batteries, separators, compression, and SWD sizing |
| `estimate_costs` | Pipeline, facility, compression, and SWD CAPEX |
| `assess_compliance` | Permits, approval timeline, and environmental risk |

### Request lifecycle

```
Agent (infrastructure-planner)
  → MCP tool call: plan_pipeline | size_facilities | estimate_costs | assess_compliance
      ↓
  Infrastructure server (src/index.ts)
      ↓
  1. callLLM(domain-specific infrastructure prompt)
     OR deterministic fallback module
  2. Return: structured pipeline, facility, cost, or compliance output
```

### Fallback logic

The server exports deterministic fallback functions for pipeline planning, facility sizing, cost estimation, and compliance assessment so CI can verify behavior without external LLM calls.

### Transport modes

- **stdio** (default): pipe-based
- **HTTP** (when `PORT=3012`): `StreamableHTTPServerTransport` — used by the infrastructure-planner agent
