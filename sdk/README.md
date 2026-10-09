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

For a consuming TypeScript package, install an available SDK release (or its
locally packed artifact) and declare Zod for the example schema. Checkout setup
uses [CONTRIBUTING.md](../CONTRIBUTING.md).

```bash
pnpm add @shaleyeah/sdk zod
```

```typescript
import { MCPServer } from "@shaleyeah/sdk";
import { z } from "zod";

// Build an MCP server
class MyServer extends MCPServer {
  constructor() {
    super({ name: "my-server", version: "0.1.0", description: "Echo a message", persona: { name: "Example", role: "example", expertise: [] } });
  }
  protected setupCapabilities(): void {
    this.registerTool({
      name: "echo", description: "Return the supplied message", type: "query",
      inputSchema: z.object({ message: z.string() }),
      outputSchema: z.object({ message: z.string() }),
      handler: async ({ message }: { message: string }) => ({ message }),
    });
  }
  protected async setupDataDirectories(): Promise<void> {}
}

const server = new MyServer();
await server.initialize();
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

`LLMClient` reads `ANTHROPIC_API_KEY` for model calls. The echo example and
transport tests need no model key. `MCPServer` uses stdio by default; setting
`PORT` selects HTTP. Each HTTP client has its own protocol instance/transport,
with bounded idle/request time and session capacity. See
[HTTP configuration and lifecycle](docs/ARCHITECTURE.md#transport-modes-mcpserver)
and [deployment settings](docs/DEPLOYMENT.md).

Session IDs identify transport state, not employee memory or authenticated
authority. #678 implements identity/source access checks. Declared schemas,
structured success and genuine tool failures are covered by #677's SDK and
Geologist boundary checks; see [tool result compatibility](docs/ARCHITECTURE.md#tool-contracts-and-result-compatibility).
Current HTTP remains a trusted development path pending access and reference
qualification.
