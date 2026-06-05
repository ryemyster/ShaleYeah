# How Development Works — @shaleyeah/server-development

## Plain language (12-year-old version)

Once you decide to buy an oil property, you need a plan for how to develop it — how many wells to drill, how far apart to space them, what it will cost, and how long it will take. You also need someone to watch the project as it progresses and alert you if it's running over budget or behind schedule.

Development is like a project manager who builds your drilling plan and then keeps tabs on how it's going. You tell it what you have (acreage, formation, budget), and it tells you what's possible and what risks to watch for.

## Technical explanation

Development is a **Tier 1 MCP tool server** — stateless. It exposes 2 project planning and monitoring tools backed by LLM synthesis.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `create_development_plan` | Well count, spacing, budget, schedule, risk assessment |
| `monitor_development_progress` | Schedule / budget / safety metrics against plan |

### Request lifecycle

```
Agent (development-planner)
  → MCP tool call: create_development_plan { wellCount, acreage, targetFormation, budget }
      ↓
  Development server (src/index.ts)
      ↓
  1. callLLM(development plan prompt)
     OR fallback: deriveDefaultDevelopmentOutlook(wellCount, budget, risks)
  2. Return: structured development plan
```

### Fallback logic

`deriveDefaultDevelopmentOutlook()` is deterministic:
- Tight budget (budget/wellCount < threshold) → "High" budget risk
- Funded small project (1–3 wells, adequate budget) → "Low" risk

### Transport modes

- **stdio** (default): pipe-based
- **HTTP** (when `PORT=3011`): `StreamableHTTPServerTransport` — used by the development-planner agent
