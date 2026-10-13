# How Drilling Works — @shaleyeah/server-drilling

## Plain language (12-year-old version)

Imagine you want to drill a well 10,000 feet deep through a shale formation in Texas. Drilling is the expert who designs the whole program: what kind of well (vertical, horizontal, directional?), how many days it'll take, what the casing looks like, what it costs, and what could go wrong.

You give it the well type, target depth, and location. It does the math, then asks Claude (acting as Perforator Maximus, Master Drilling Strategist) to flag the risks and give a recommendation. If Claude isn't available, it still gives you a reasonable answer using built-in domain rules.

## Technical explanation

Drilling is a **Tier 1 MCP tool server** — stateless, no session memory. It exposes 1 tool: `design_drilling_program`.

### Request lifecycle

```
Agent (drilling-engineer)
  → MCP tool call: design_drilling_program { wellParameters, location, constraints }
      ↓
  Drilling server (src/index.ts)
      ↓
  1. Compute deterministic estimates:
     - Cost = depth × rate (varies by well type)
     - Days = depth / ROP (varies by well type)
  2. synthesizeDrillingAnalysisWithLLM(params)  → callLLM()
     OR fallback: deriveDefaultDrillingInterpretation()
  3. Return full drilling program: trajectory, casing, costs, risks, interpretation
```

### Deterministic cost logic

```
Vertical:    cost = depth × $120/ft
Directional: cost = depth × $140/ft
Horizontal:  cost = depth × $180/ft
Total cost   = well cost × 1.8 (includes completion + facilities)
```

### LLM synthesis

The LLM prompt gives Perforator Maximus the well parameters and asks for:
- `programRisk`: High / Medium / Low
- `keyConsiderations`: array of 3 risk/consideration strings
- `recommendation`: one-sentence recommendation

The LLM output enriches the deterministic result — it doesn't replace it.

### Transport modes

- **stdio** (default): pipe-based, used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3003`): `StreamableHTTPServerTransport` — used by the drilling-engineer agent
