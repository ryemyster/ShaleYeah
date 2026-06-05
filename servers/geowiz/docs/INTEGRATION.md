# Integration — @shaleyeah/server-geowiz

## Who calls geowiz?

The `geologist` agent (`agents/geologist/`) is the primary consumer. It calls geowiz over HTTP using `StreamableHTTPClientTransport` from `@shaleyeah/sdk`.

## Connection pattern (agent side)

```typescript
// agents/geologist/src/agent/geowiz-client.ts
import { StreamableHTTPClientTransport } from "@shaleyeah/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export async function callGeowizTool(
    serverUrl: string,
    toolName: string,
    args: Record<string, unknown>,
): Promise<unknown> {
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    const client = new Client({ name: "geologist-agent", version: "0.1.0" }, { capabilities: {} });
    await client.connect(transport);
    const result = await client.callTool({ name: toolName, arguments: args });
    await client.close();
    return result;
}
```

The agent resolves the URL from `AgentRuntimeConfig.mcpServers.geowiz.url` — defaulting to `http://localhost:3001`.

## Calling a tool

```typescript
import { callGeowizTool } from "./geowiz-client.js";

const result = await callGeowizTool(
    "http://localhost:3001",
    "analyze_formation",
    {
        filePath: "/data/well-logs/JONES_1H.las",
        formations: ["wolfcamp", "bone spring"],
        depth: { top: 8500, base: 11200 },
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `analyze_formation` | `filePath`, `formations` | `GeologicalAnalysis` |
| `process_gis` | `filePath` | `GISAnalysis` |
| `process_well_logs` | `filePath` | `WellLogData` |
| `assess_quality` | `filePath` | `QualityAssessment` |
| `process_access_database` | `filePath` | `DatabaseAnalysis` |
| `process_document` | `filePath` | `DocumentAnalysis` |
| `process_seismic_data` | `filePath` | `SeismicAnalysis` |
| `process_aries_database` | `filePath` | `AriesAnalysis` |

## Upstream dependencies

Geowiz has no upstream MCP servers — it reads files from the filesystem and calls the Anthropic API directly.

```
Filesystem (LAS, GeoJSON, etc.)
  ↓
geowiz (port 3001)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
geowiz (port 3001)
  ↑ MCP over HTTP
geologist agent (port 4001)
  ↑ LocalAgentRuntime
Orchestrator / Claude Desktop / API client
```

## Error types

Geowiz returns structured errors following the `error_type` contract:

```json
{ "error_type": "retryable", "message": "LLM timeout — retry in 5s" }
{ "error_type": "permanent", "message": "Unsupported file format: .tiff" }
```

The agent layer reads `error_type` to decide whether to retry or escalate.

## MCP protocol version

Geowiz declares `mcp: "2025-03"` in its SDK compatibility block. Agents must connect with a compatible MCP client version.
