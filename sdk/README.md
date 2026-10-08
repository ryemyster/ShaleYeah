# @shaleyeah/sdk

TypeScript helpers for SHALE YEAH — domain types, LLM client, MCP base server,
file parsers and existing runtime contracts.

## What this package is

The current TypeScript MCP servers and remaining TypeScript employees use this
package. Python ADK employees call tool servers through MCP rather than importing
this SDK. New employee business records live in the independent
[`contracts/` package](../contracts/README.md), which supplies the common JSON
schemas and Python/TypeScript validation. Install SDK helpers only when needed
by your TypeScript unit.

## Quick start

```bash
pnpm add @shaleyeah/sdk
```

```typescript
import { MCPServer, LLMClient, AgentManifest } from "@shaleyeah/sdk";

// Build an MCP server
class MyServer extends MCPServer {
  constructor() {
    super({ name: "my-server", version: "0.1.0", description: "...", persona: { name: "...", role: "...", expertise: [] } });
    this.registerTool("my_tool", MyToolSchema, async (args) => { ... });
  }
}

// Call an LLM
const client = new LLMClient();
const response = await client.complete([{ role: "user", content: "analyze this well" }]);
```

## What's in here

| Module | What it gives you |
|--------|-------------------|
| `MCPServer` | Base class for all Tier 1 MCP tool servers |
| `LLMClient` | Shared Anthropic SDK wrapper — all LLM calls go through here |
| `ServerFactory` | Standardized server bootstrap |
| `AgentManifest`, `AgentRuntime`, `AgentService` | Existing TypeScript tool/runtime configuration and interfaces; distinct from portable employee business records |
| `FileIntegrationManager` | Unified file ingestion (LAS, Excel, GIS, SEGY) |
| `FileFormatDetector` | Auto-detect file type by extension + magic bytes |
| Domain types | `LASData`, `GeologicalAnalysis`, `EconomicAnalysis`, `RiskAssessment`, etc. |

## Running tests

```bash
pnpm test
```

## Building

```bash
pnpm build       # emits to dist/
pnpm type-check  # type-only, no emit
```

## Configuration

The `LLMClient` reads `ANTHROPIC_API_KEY` from the environment. No other env vars are required by the sdk itself.
