# Integration — @shaleyeah/server-econobot

## Who calls econobot?

The `economist` agent (`agents/economist/`) is the primary consumer. It connects to econobot over HTTP using `StreamableHTTPClientTransport` from `@shaleyeah/sdk`.

## Connection pattern (agent side)

```typescript
import { callEconobotTool } from "./econobot-client.js";

const result = await callEconobotTool(
    "http://localhost:3002",
    "analyze_economics",
    {
        filePath: "/data/economics/JONES_1H_DCF.xlsx",
        dataType: "mixed",
        discountRate: 0.1,
        analysisType: "comprehensive",
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `analyze_economics` | `filePath`, `dataType` | `EconomicAnalysis` |
| `calculate_dcf` | `cashFlows`, `discountRate` | DCF result with NPV/IRR |
| `sensitivity_analysis` | `baseCase`, `ranges` | Scenario sensitivity table |

## Upstream dependencies

Econobot reads files from the filesystem and calls the Anthropic API directly. No upstream MCP servers.

```
Filesystem (Excel, CSV)
  ↓
econobot (port 3002)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
econobot (port 3002)
  ↑ MCP over HTTP
economist agent (port 4002)
  ↑ LocalAgentRuntime
Orchestrator / API client
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout — retry in 5s" }
{ "error_type": "permanent", "message": "Unsupported file format: .pdf" }
```

## MCP protocol version

Declares `mcp: "2025-03"`. Agents must connect with a compatible MCP client version.
