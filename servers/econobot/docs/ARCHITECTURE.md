# Architecture — @shaleyeah/server-econobot

## Role

Tier 1 MCP tool server. Provides financial modeling tools — discounted cash flow, IRR, NPV, sensitivity analysis, and investment screening. Paired with the `economist` agent (port 4002).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `analyze_economics` | `performEconomicAnalysis()` | ✅ `callLLM` | Full economic analysis: NPV, IRR, payback, breakeven |
| `calculate_dcf` | direct | ✅ `callLLM` | Discounted cash flow with multiple periods |
| `sensitivity_analysis` | `performSensitivityAnalysis()` | ✅ `callLLM` | Oil/gas price and production variance scenarios |

## LLM + fallback pattern

Each tool constructs a prompt with the raw financial inputs (oil price, gas price, production forecast, costs) and calls `callLLM()` once. Fallback: `EconomicsSchema` (from `@shaleyeah/sdk`) validates the LLM output; if parsing fails, deterministic DCF math is returned directly.

Uses `EconomicsSchema` from `@shaleyeah/sdk` canonical model to validate and normalize LLM output before returning to callers.

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3002`): `StreamableHTTPServerTransport` — used by the agent fleet

Transport selection is automatic at startup via `MCPServer` in `@shaleyeah/sdk` — no per-server code change needed.

## Data flow

```
MCP tool call: analyze_economics { filePath, dataType, discountRate }
  → performEconomicAnalysis(args)
  → read file (Excel / CSV)
  → callLLM(prompt with financial data)
    → Claude: EconomicAnalysis JSON
  ↘ fallback: generateDefaultAnalysis()
```

## File parsing

Supports `.xlsx`, `.xls` (via `exceljs`) and `.csv`. Raw data is extracted into a uniform `Record<string, unknown>` before being passed to the LLM prompt.

## Dependencies

```
@shaleyeah/server-econobot
  ├── @shaleyeah/sdk   (MCPServer, callLLM, EconomicsSchema)
  └── exceljs          (Excel file parsing)
```
