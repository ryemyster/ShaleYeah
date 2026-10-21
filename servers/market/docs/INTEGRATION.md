# Integration — @shaleyeah/server-market

## Who calls market?

The `market-analyst` agent (`agents/market-analyst/`) connects over HTTP.

## Example call (agent side)

```typescript
import { callMarketTool } from "./market-client.js";

const result = await callMarketTool(
    "http://localhost:3007",
    "analyze_market_conditions",
    {
        commodity: "both",
        region: "Permian Basin",
        timeframe: "1year",
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `analyze_market_conditions` | `commodity`, `region` | Market analysis with prices, trend, outlook |
| `competitive_analysis` | `competitors`, `market` | Competitor profiles with market share |

## Upstream dependencies

Market calls the EIA API for live prices (optional) and Anthropic API for synthesis.

```
EIA API (optional, live prices)
  ↓
market (port 3007)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
market (port 3007)
  ↑ MCP over HTTP
market-analyst agent (port 4007)
```

## Error types

```json
{ "error_type": "retryable", "message": "EIA API unavailable — using stub prices" }
{ "error_type": "permanent", "message": "Unknown commodity type" }
```
