# Integration — @shaleyeah/server-research

## Who calls research?

The `research-analyst` agent (`agents/research-analyst/`) connects over HTTP.

## Example call (agent side)

```typescript
import { callResearchTool } from "./research-client.js";

const result = await callResearchTool(
    "http://localhost:3008",
    "conduct_market_research",
    {
        topic: "Permian Basin M&A activity",
        region: "West Texas",
        scope: "regional",
        timeframe: "current",
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `conduct_market_research` | `topic`, `region` | Market research summary with key findings |
| `analyze_competition` | `competitors`, `basin` | Competitor profiles and positioning |

## Upstream dependencies

Research fetches from the web (via `web-fetch.ts`) and Anthropic API.

```
Web (HTTP fetches)
  ↓
research (port 3008)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
research (port 3008)
  ↑ MCP over HTTP
research-analyst agent (port 4008)
```

## Error types

```json
{ "error_type": "retryable", "message": "Fetch timeout — retry" }
{ "error_type": "permanent", "message": "Invalid scope parameter" }
```
