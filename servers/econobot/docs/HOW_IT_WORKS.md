# How Econobot Works — @shaleyeah/server-econobot

## Plain language (12-year-old version)

Imagine you're deciding whether to spend $10 million drilling a well. Econobot is the financial expert who takes your spreadsheet of oil prices, production forecasts, and drilling costs, and tells you: "Here's your NPV, here's what happens if oil prices drop 20%, and here's when you'll break even."

You hand Econobot a file. It reads the numbers, asks Claude to interpret the financial picture, and returns a structured analysis. If the AI is unavailable, it falls back to running the math directly — discounted cash flow is just arithmetic.

## Technical explanation

Econobot is a **Tier 1 MCP tool server** — stateless, no session memory. It exposes 3 financial modeling tools via the Model Context Protocol.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `analyze_economics` | Reads Excel/CSV, runs DCF, NPV, IRR, payback, breakeven analysis |
| `calculate_dcf` | Takes raw cash flow arrays and computes NPV/IRR directly |
| `sensitivity_analysis` | Varies oil price, gas price, and production across a scenario range |

### Request lifecycle

```
Agent (economist)
  → MCP tool call: analyze_economics { filePath, dataType, discountRate }
      ↓
  Econobot (src/index.ts)
      ↓
  1. Read file (exceljs for .xlsx/.xls, custom parser for .csv)
  2. Build prompt with raw financial data
  3. callLLM(prompt)          → Anthropic API
     OR fallback: generateDefaultAnalysis() → deterministic DCF math
  4. Validate output against EconomicsSchema (from @shaleyeah/sdk)
  5. Return EconomicAnalysis JSON
```

### LLM + fallback pattern

```typescript
try {
  return await analyzeEconomicData(economicData, args);  // calls callLLM()
} catch (_error) {
  return generateDefaultAnalysis();  // pure arithmetic fallback
}
```

The fallback produces real DCF math — not placeholder values. A result is always returned even with no API key.

### Transport modes

- **stdio** (default): pipe-based, used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3002`): `StreamableHTTPServerTransport` — used by the economist agent fleet

Transport is selected automatically at startup based on whether `process.env.PORT` is set.
