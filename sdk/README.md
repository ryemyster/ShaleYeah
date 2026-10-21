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
The SDK builds with its own TypeScript configuration and packs only built code,
types and license into its runtime archive. The
[reference extraction proof](../docs/reference-packages.md) installs that archive
with explicit contract/connector dependencies outside the checkout.

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
`PORT` selects HTTP. SDK 0.3.0 selects MCP 2026-07-28 explicitly for both
transports. Each HTTP request has its own protocol instance, bounded execution
time, body size and concurrency. There is no initialization handshake or
transport session ID. Older protocol clients receive an explicit rejection;
upgrade and pin their modern profile before connecting. See
[HTTP configuration and lifecycle](docs/ARCHITECTURE.md#transport-modes-mcpserver)
and [deployment settings](docs/DEPLOYMENT.md).

HTTP requires explicit local/remote `http.access` configuration, a dedicated
credential or trusted verifier, scoped policy and audit sink. Setting PORT alone
fails before listening; use [HTTP access configuration](docs/http-access.md).
Employee memory and authority remain independent of the transport. Declared schemas,
structured success and genuine tool failures are covered by #677's SDK and
Geologist boundary checks; see [tool result compatibility](docs/ARCHITECTURE.md#tool-contracts-and-result-compatibility).
Actual issuer/TLS deployment, source rights, review and reference qualification
remain with their owning adapters and acceptance checks.

Analysis tools preserve zero confidence and report missing/invalid scores as
null with an explicit status. Existing four-argument factory calls retain raw
numbers with an undeclared scale; an optional fifth argument declares validated
units. Consumers must check status/scale before using a score. See
[confidence metadata and role compatibility](docs/confidence-metadata.md).

The legacy default async-job poller reports unsupported without network access.
No backend currently declares a qualified `get_job_status` capability. A trusted
caller can still inject its own configured bounded poller; #692 owns final
legacy helper deletion.

## Retained TypeScript client connections

`loadMCPClientConnection(endpoint, prefix)` reads a dedicated private bearer
file named by `<PREFIX>_MCP_ACCESS_TOKEN_FILE`, validates HTTPS or loopback HTTP,
and normalizes historical bare local URLs to `/mcp`. It denies redirects and
limits decoded response bytes to 1 MiB. `discoverMCPTool` reads a fresh catalog
with a 32-page limit so the caller can supply the exact tool definition to the
pinned official client. `mcpCommandFailure` emits safe permanent error categories
without copying server messages or secret-bearing causes.

Economist, Reservoir Engineer and QA use these helpers with a 30-second default
and 120-second maximum call deadline. Failed tool results and uncertain failures
after dispatch stop automatic retry. `input_required` requires reviewed input;
the connection does not automatically answer it. Model credentials, employee
context and business review authority remain separate from MCP access.

## Python employee transport

[python/](python/README.md) builds the separate `shaleyeah-mcp-client` wheel.
It provides configured Streamable HTTP, credential references, schema/results,
safe typed failures and bounded setup retries without repeating dispatched tools.
It does not import ADK, domain logic or this TypeScript SDK. All 11 Python
employees declare the client and use its shared configuration loader. Role
workflow qualification remains separate from wire compatibility.
See its package-local checks, wheel-isolation and actual-Geowiz controls.

## Reference model bindings

Geologist and Geowiz use explicit Gemini or Anthropic profiles, fixed model IDs,
private owner-scoped credential references, bounded calls and independent judge
configuration. Geologist remains Stand-alone Agent with Progressive Disclosure
(Skills); provider configuration adds no orchestration or approval authority.
Missing/unsupported configuration and synthesis failures are explicit errors.
See [configuration and offline qualification](../docs/model-providers.md).

## Correlated employee events

SDK 0.2.0 depends on portable contracts 0.3.0 and exports `EventEmitter`,
`EventExportError`, `createJsonlSink`, `loadJsonlEmitter`, `bindMCPEvents` and
`MCPCorrelationError`. Supply a trusted emitter through `MCPServerConfig.events`
or factory runtime options to record tool dispatch/completion. The binding rejects
foreign/missing metadata before dispatch; the success schema is checked before
a successful event. Required audit failure blocks before execution and reports
uncertain effects afterward. Operational stdio messages use stderr; stdout remains
MCP frames. [Employee events](../docs/employee-events.md) explains private setup,
redaction, optional sinks and measurement limits. HTTP/source authorization audit
remains an independent requirement.

## Employee helpers

The independently installable [Python employee helpers](employee/README.md) own
scoped context, configured providers, metadata events, optional native ADK state
and protected review continuation. Role factories supply persona and tools.
The TypeScript SDK now shares the durable review store, owner-only JSON reader
and installed qualification launcher; role adapters own action, destination,
source interface and exact candidate validation.

Review preparation accepts an optional cancellation signal. It propagates to
source reads and is checked before the packet transaction, so a timed-out
request cannot create a late successful checkpoint.
