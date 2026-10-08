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

The [migration ledger](../docs/legacy-migration-ledger.md#sdk-source-and-public-exports)
maps SDK callers and compatibility decisions. Domain tools and parsers remain
retention candidates within tested limits; employee execution helpers stay until
their supported consumers migrate and public API impact is resolved in #692.

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

The task-loop parser accepts raw JSON and outer JSON/untagged code fences.
It strips outer markers with string operations so long whitespace responses
cannot trigger regex backtracking, and literal fence text inside JSON values is
preserved. Invalid JSON retains the existing task-loop fallback behavior.
The parser regressions use mocked responses, including a killable stress worker.

`ContextStore` remains process-local and does not enforce authenticated namespace
access or reviewed sharing. The portable context policy is
[ADR 0002](../contracts/docs/0002-context-lifecycle.md); durable implementation is
owned by #672 and supporting trust/review issues.

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
