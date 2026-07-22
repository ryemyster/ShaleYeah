# Architecture — @shaleyeah/sdk

## Role in the two-tier system

```
agents/*  (Tier 2)       servers/*  (Tier 1)
    └── depends on ──→  @shaleyeah/sdk ←── depends on ──┘
```

The sdk sits at the foundation. Every Tier 1 MCP server extends `MCPServer`. Every Tier 2 agent implements `AgentManifest` and runs inside `AgentRuntime`. Neither tier knows about the other — the sdk is their shared vocabulary, not their integration layer.

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

All LLM calls flow through `callLLM()` from `llm-client.ts` — nowhere else in the sdk or its consumers should directly instantiate `@anthropic-ai/sdk`. This enforces a single place for prompt caching, model pinning, and retry logic.

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
