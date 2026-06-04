# @shaleyeah/sdk

Shared language for the ShaleYeah agent fleet — types, LLM client, MCP base server, file parsers, and agent contracts.

## What this package is

Every ShaleYeah agent and MCP server speaks the same language. This package is that language: the interfaces, base classes, and utilities that all 14 servers and 14 agents depend on. If you're building a new agent or server in this fleet, you depend on `@shaleyeah/sdk`.

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
| `AgentManifest`, `AgentRuntime`, `AgentService` | Tier 2 agent contracts |
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
