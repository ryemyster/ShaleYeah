# Architecture — @shaleyeah/sdk

The package owns its TypeScript build settings. Its runtime archive contains
built modules/types and license, with declared portable contract dependencies.
The [reference extraction proof](../../docs/reference-packages.md) compiles the
tool against packed helpers and tests installed consumers outside the checkout;
it uses no SDK source links. Existing public APIs stay until caller-owned cleanup.

## Role in the two-tier system

```
Remaining TypeScript agents       TypeScript MCP servers
    └── depends on ──→  @shaleyeah/sdk ←── depends on ──┘
```

Current TypeScript MCP servers and the remaining TypeScript employees use these
helpers. ADK/Python employees call tool servers through MCP. Portable employee
business records live in [`contracts/`](../../contracts/README.md), which can be
installed independently of this SDK.

## Module topology

```
sdk/src/
├── index.ts               Public API — exports supported SDK helpers
├── types.ts               Domain types: LAS, geological, economic, risk, market
├── canonical-model.ts     Zod schemas: FormationSchema, EconomicsSchema, ProductionSchema,
│                          RiskProfileSchema, DecisionSchema, WellAnalysisContextSchema
├── mcp-server.ts          MCPServer base class — all servers extend this
├── mcp-http-requests.ts   Internal bounded, stateless HTTP exchange lifecycle
├── mcp-http-access.ts     Internal verified HTTP identity/scopes/audit/context boundary
├── server-factory.ts      ServerFactory — bootstraps an MCPServer from config
├── confidence-metadata.ts Internal score availability/range/declared-scale validation
├── llm-client.ts          callLLM() — sole source of truth for all LLM calls
├── contracts.ts           AgentManifest, AgentRuntimeConfig, HumanApproval Zod schemas
├── agent-loop.ts          Existing task loop; raw/outer-fenced JSON parser using string operations
├── context-store.ts       Process-local namespace map; not authenticated durable context
├── runtime.ts             LocalAgentRuntime — wraps manifest, owns lifecycle + HITL gate
├── service.ts             LocalAgentEndpoint — HTTP endpoint for an agent runtime
├── errors.ts              RetryableToolError, PermanentToolError — error classification
├── file-detector.ts       FileFormatDetector — magic-byte + extension detection
├── file-integration.ts    FileIntegrationManager — orchestrates parsers
├── file-utils.ts          Low-level file read/write helpers
└── parsers/
    ├── las-parser.ts      LAS 2.0 well log format
    ├── excel-parser.ts    Excel workbooks (exceljs)
    ├── gis-parser.ts      GeoJSON, Shapefile, KML (turf, shapefile, xml2js)
    └── segy-parser.ts     SEG-Y seismic format
```

## LLM calls

The task-loop JSON parser strips only outer code-fence markers with trim/prefix/
suffix operations. It preserves literal backticks in JSON values and avoids
unanchored whitespace regex backtracking on large model responses. Malformed JSON
retains the existing fallback behavior. Parser regressions run with mocked model
responses and a timeout-controlled child process.

Context ownership, reviewed sharing, compaction and invalidation follow
[ADR 0002](../../contracts/docs/0002-context-lifecycle.md). The existing map and
stored synthesized output do not enforce those policies.
[ADR 0003](../../contracts/docs/0003-authority-and-review.md) specifies trusted
authority; #678 supplies configured HTTP ingress, while #672/#673 implement durable context and authenticated review.
Storage and retrieval adapters remain
optional, selected through measured role qualification.

TypeScript LLM calls flow through `callLLM()` from `llm-client.ts` — SDK consumers should not directly instantiate `@anthropic-ai/sdk`. This keeps prompt caching, model pinning, and retry logic in one place. ADK/Python employees select their own provider adapters.

## Transport modes (MCPServer)

`MCPServer` selects transport at startup:

- **stdio** (default): when `process.env.PORT` is not set
- **HTTP**: when `process.env.PORT` is set, with explicit `http.access`; each
  request receives a fresh protocol instance through the maintained SDK handler

All 14 Tier 1 servers inherit this boundary. Their HTTP launchers must supply
identity/scopes/audit configuration; setting a port alone fails before listening.
Factory constructors accept optional runtime HTTP/data-path settings. See
[configured access and verified handler context](http-access.md) and the
[Geowiz local launcher](../../servers/geowiz/docs/HTTP_ACCESS.md).

SDK 0.3.0 selects protocol 2026-07-28 with TypeScript server/client 2.3.1 and
Node adapter 2.1.1. HTTP uses `createMcpHandler`/`toNodeHandler`; stdio uses
`serveStdio`. Both explicitly reject the historical protocol profile. A plain
library upgrade would keep the old wire behavior, so clients must also pin
2026-07-28. See the [official migration guide](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28.html).

HTTP requests carry their version, client capabilities and routing metadata.
The maintained SDK validates that envelope and header/body consistency. Our
access boundary separately verifies credentials, scopes and required audit
before dispatch. Client metadata cannot grant authority. Transport session IDs
are rejected. Domain stores, exact source handles, employee context and human
review remain owned by their existing durable adapters.

Each protocol instance receives the current tool/resource registry. Later
registrations are visible on subsequent discovery. `MCPServerConfig.http`
accepts `requestTimeoutMs`, `maxConcurrentRequests` and `maxRequestBodyBytes`;
[deployment settings](DEPLOYMENT.md#environment-variables) specify bounds.
Incomplete bodies time out with 408. An operation deadline closes its own
exchange and signals cancellation without aborting another request. A possible
effect remains uncertain; transport closure never authorizes automatic replay.

Shutdown closes in-flight exchanges before draining the listener. Restart
creates a new handler. `PORT=0` chooses a local test port and `httpPort()` returns
it after startup. The health and configured metadata endpoints keep their
existing access rules. Optional MCP subscriptions, MRTR and task extensions are
not selected role workflows; canonical employee input/review records retain
their own business meaning.

`mcp-stateless.test.ts` and `mcp-http-lifecycle.test.ts` cover no-handshake calls,
separate instances, capacity/deadline/body bounds, explicit legacy rejection,
dynamic discovery and restart. Access, tool-contract, employee-event and
provider-cancellation controls exercise the actual modern client/server path.
These controls do not certify professional findings or a deployment target;
reference and fleet qualification retain their owning gates.

## Tool contracts and result compatibility

`MCPTool` and `ServerToolTemplate` share one definition. Factory registration
preserves the full Zod input object, optional success `outputSchema`, title,
annotations and `_meta`. The pinned SDK advertises and validates those schemas;
strict-object constraints are retained. Annotations are untrusted behavior
hints and do not grant identity, source access or approval.

| Handler result | MCP representation |
| --- | --- |
| Declared success output schema | Raw handler object in `structuredContent` and matching JSON text; the advertised schema validates that object |
| Existing `success: true/false` or recognized `error_type`/`error` record | Preserve its envelope instead of wrapping it in another success; failures set `isError: true` |
| Raw output without an output schema | Retain the existing `success`/`data`/metadata envelope, plus matching `structuredContent` |
| Thrown tool failure | JSON error details and `isError: true`; native retry classification is retained |
| Failure for a tool declaring a success schema | JSON error text and `isError: true`, with no success `structuredContent`; the pinned generic client otherwise validates the error against the success schema |

The compatibility text is generated from the same serialized object as structured
success. Analysis/file factories pass supported returned failures through before
adding analysis/data metadata. A `partial` domain status remains partial; MCP
invocation completion is not completed or accepted employee work.

Migration: factory analysis/file outcomes previously appeared beneath an extra
outer `data`. Read their preserved `analysis`/`data` and metadata directly now.
The three remaining TypeScript clients and nine other Python wrappers read the
retained `content` blocks without assuming that nesting in source. They are not
qualified fleet clients: owners in the [migration ledger](../../docs/legacy-migration-ledger.md)
must adopt validation/status handling before release. The Geologist wrapper
validates the selected tool, preserves structured evidence, rejects conflicting
JSON text and retains a documented text-only legacy path when no output schema
is advertised. It now delegates those checks and configured credential/protocol
handling to the installed [Python client](../python/README.md); the other role
owners remove their copies when adopting it.

`tests/mcp-tool-contract.test.ts` uses real HTTP MCP clients and the factory to
check schemas, strict input, discovery metadata, typed/raw success, partial
output, thrown/returned/XOR errors and file helper outcomes. Synthetic output
schemas prove boundary support, not the accuracy or completeness of every
Geowiz domain schema; #671/#674 qualify the actual reference tools and employee.

Analysis confidence metadata distinguishes `available`, `unavailable`, `invalid`
and `unscaled` values. Zero is preserved; missing/invalid values are null, with
no score fabrication or inferred scale conversion. The optional trusted factory
declaration supplies `unit_interval` or `percentage`; legacy callers retain
raw supported numbers with a null scale. See
[confidence compatibility and the 47-call inventory](confidence-metadata.md).
These fields do not provide professional qualification or action authority.

## Error classification

`errors.ts` exports `RetryableToolError`, `PermanentToolError`,
`classifyToolError` and `isToolFailure`. Native error classes take precedence over
the retained legacy message classifier; factories and direct registrations use
the same classification. Supported failure records use `success: false` or a
known `error_type` with an error payload. These labels inform recovery; they do
not establish permission or idempotency for retries:

```typescript
throw new RetryableToolError("LLM timeout");   // agent sees error_type: "retryable"
throw new PermanentToolError("Invalid input");  // agent sees error_type: "permanent"
```

## Canonical model schemas

`canonical-model.ts` exports validated Zod schemas for the shared O&G domain model:

| Schema | Purpose |
|--------|---------|
| `FormationSchema` | Geological formation data |
| `EconomicsSchema` | NPV, IRR, production economics |
| `ProductionSchema` | Well production rates and profiles |
| `RiskProfileSchema` | Risk categories and scores |
| `DecisionSchema` | Investment decision structure |
| `WellAnalysisContextSchema` | Full well analysis context bundle |

## File ingestion flow

```
FileFormatDetector → detects type
FileIntegrationManager → routes to correct parser
LASParser / ExcelParser / GISParser / SEGYParser → typed result
```

Results are typed `ParsedFileResult` — consumers never need to import individual parser types.

## Orchestrator connection

The sdk has no knowledge of the orchestrator (`@shaleyeah/orchestrator`). When Temporal workflows are introduced (#362), the orchestrator will depend on sdk contracts, not the reverse.

## Reference model bindings

Geologist and Geowiz use explicit Gemini or Anthropic profiles, fixed model IDs,
private owner-scoped credential references, bounded calls and independent judge
configuration. Geologist remains Stand-alone Agent with Progressive Disclosure
(Skills); provider configuration adds no orchestration or approval authority.
Missing/unsupported configuration and synthesis failures are explicit errors.
See [configuration and offline qualification](../../docs/model-providers.md).

## Employee event boundary

`events.ts` owns serialized async export and private JSONL. `mcp-events.ts` binds
native MCP correlation to a separately trusted emitter and verified HTTP principal.
`mcp-server.ts` records start before dispatch, validates successful outputs, and
records failure without exception prose. Each emitter has its own stream/sequence;
run/trace/scope/task revision and causal parent/span IDs link producers. The
[portable event contract](../../docs/employee-events.md) supplies bounded metadata
and redaction; no role, ADK or SIEM dependency enters that contract.

## Shared employee and review adapters

`sdk/employee` is an independently installable Python helper package. Geologist
and Reporter retain their role factories while using scoped state, providers,
events and native adapters from that package. It imports no employee brain.
TypeScript `employee-review.ts` shares exact revision/authority/qualification
state and SQLite continuation. Role-owned adapters bind schemas, scopes, sources,
action/destination and candidate checks; no model argument selects those adapters.
