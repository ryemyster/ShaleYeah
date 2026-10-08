# Architecture — @shaleyeah/sdk

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
├── index.ts               Public API — re-exports everything below
├── types.ts               Domain types: LAS, geological, economic, risk, market
├── canonical-model.ts     Zod schemas: FormationSchema, EconomicsSchema, ProductionSchema,
│                          RiskProfileSchema, DecisionSchema, WellAnalysisContextSchema
├── mcp-server.ts          MCPServer base class — all servers extend this
├── server-factory.ts      ServerFactory — bootstraps an MCPServer from config
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
authority; #672/#678/#673 implement durable context and authenticated entry/review.
Storage and retrieval adapters remain
optional, selected through measured role qualification.

TypeScript LLM calls flow through `callLLM()` from `llm-client.ts` — SDK consumers should not directly instantiate `@anthropic-ai/sdk`. This keeps prompt caching, model pinning, and retry logic in one place. ADK/Python employees select their own provider adapters.

## Transport modes (MCPServer)

`MCPServer` auto-detects transport at startup:
- **stdio** (default): when `process.env.PORT` is not set
- **HTTP**: when `process.env.PORT` is set → `StreamableHTTPServerTransport` on that port

Zero per-server code change required — all 14 Tier 1 servers use this auto-detection.

## Error classification

`errors.ts` exports `RetryableToolError` and `PermanentToolError`. Servers throw these to signal whether a caller should retry:

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
