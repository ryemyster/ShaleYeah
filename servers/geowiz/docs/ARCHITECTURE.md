# Architecture — @shaleyeah/server-geowiz

## Role

Tier 1 MCP tool server. Exposes 9 domain tools and model-profile discovery and two source query/status tools over the MCP protocol. Has no knowledge of the agent layer — it only handles tool calls.

## Tool inventory

There are nine domain operations and three discovery/query/status operations. Only formation
analysis currently uses a model. Other processor outputs still need source and
format qualification; a successful RPC does not certify their professional quality.

| Tool | Model use |
| --- | --- |
| `analyze_formation` | Deterministic LAS review; optional injected Gemini/Anthropic annotation |
| `fetch_source`, `get_source_status` | Verified source provenance/health without model calls |
| `get_model_profile` | Public binding discovery without secret references |
| `process_gis`, `process_well_logs`, `process_access_database` | Existing processors; no model call |
| `process_document`, `process_seismic_data`, `process_aries_database` | Existing processors; no model call |
| `assess_quality` | Actual LAS completeness; accuracy/confidence unmeasured |
| `save_finding` | File write; caller needs independent authorization/review |

## Local tools (src/tools/)

Private to this package — not re-exported, not part of the public API.

| File | Purpose |
|------|---------|
| `las-parse.ts` | Synchronous LAS 2.0 parser used by the inline formation analysis path |
| `las-review.ts` | Source-hashed observations, explicit density assumptions, nullable conclusions and review revision |
| `curve-qc.ts` | Observed CLI curve statistics; RMSE helper requires an explicit paired reference |
| `gis-processor.ts` | GeoJSON, Shapefile, KML parsing with turf.js spatial analysis |
| `well-log-processor.ts` | Multi-format well log dispatch (wraps las-parse) |
| `access-processor.ts` | Access/MDB table extraction |
| `document-processor.ts` | PDF and text extraction |
| `seismic-processor.ts` | SEG-Y binary format parsing |
| `aries-processor.ts` | ARIES production database extraction |
| `witsml-processor.ts` | WITSML XML well log format |

`gis-processor`, `well-log-processor`, `access-processor`, `document-processor`, `seismic-processor`, and `aries-processor` are loaded as **dynamic imports** inside their tool handlers — deferred until called so server startup stays fast.

## Data flow

The ADK employee calls MCP over the installed Python client; it does not import
server implementation functions. Before model-backed analysis it discovers and
checks the backend's public effective profile. The HTTP ingress supplies the
verified customer/employee and scopes. The synthesis boundary checks ownership,
fetches an independently permitted LAS snapshot, performs curve checks, and invokes its private native SDK runtime.
Structured output is validated and returned with provider/model revisions.
Model outage/invalid output produces a marked partial result with deterministic
evidence retained. Missing runtime configuration leaves annotation unconfigured;
ownership, credential and cancellation failures remain errors. The configured
employee pair still requires and verifies its selected synthesis binding.

The injected runtime is captured in each server's tool template before the SDK
factory constructs/registers capabilities. Each analysis gets a fresh bounded
synthesis budget; no global key or vendor default is consulted. Nonmodel tools
remain usable without a model key. [Provider setup](../../../docs/model-providers.md)
explains the contract and limits; [HTTP access](HTTP_ACCESS.md) explains authority.

The [LAS review contract](LAS_REVIEW.md) distinguishes observed curves, supplied
calculation assumptions and unknown geological conclusions. Package-local
parsers for other formats remain outside this reference qualification.

`src/source-tools.ts` centralizes read-only file tool enforcement.
`src/source-config.ts` supplies the local private-file policy/audit adapter;
remote runtimes inject their own trusted current-grant service. The connector
checks exact customer/asset/task/revision/employee/subject, rights/scopes,
source hash/revision, freshness and units before credential resolution, reads
and publication. It requires durable audit acknowledgment and rechecks revocation.
Parsers consume a private copy of verified bytes. MCP output provenance uses
`sourceArtifact`; old file metadata and caller-controlled output-file writes
are displaced at that boundary. Existing domain helpers are not secured APIs.

The primary employee mode remains **Stand-alone Agent with Progressive Disclosure
(Skills)**; this is deterministic tool/data enforcement. Human geologists must
review interpretation and independently approve persistence; read grants do not
approve findings. The current source transport supports narrow LAS/CSV; only LAS
is consumed by Geowiz analysis/QC handlers. Other format handlers decline until
their adapter profile is qualified. See [source setup](DATA_SOURCES.md).

## Dependencies

```
@shaleyeah/server-geowiz
  ├── @shaleyeah/connectors (scoped source runtime, private snapshots)
  ├── @shaleyeah/contracts  (portable employee/source records)
  ├── @shaleyeah/sdk      (MCPServer, configured model runtime, domain types)
  ├── @turf/turf           (GIS spatial operations in gis-processor)
  ├── shapefile            (Shapefile parsing in gis-processor)
  └── xml2js               (KML/WITSML XML parsing)
```

---

## See also

- [README](../README.md) — quick start, Claude Desktop config, tool table
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — plain-language + technical lifecycle
- [INTEGRATION.md](INTEGRATION.md) — calling geowiz tools from an agent or MCP client
- [DEPLOYMENT.md](DEPLOYMENT.md) — stdio vs HTTP, Docker, Kong, production checklist
- [LOCAL_TESTING.md](LOCAL_TESTING.md) — running locally, testing tools directly
- [DEVELOPMENT.md](DEVELOPMENT.md) — adding tools, LLM wiring pattern, TDD checklist

## Correlated tool observations

The server factory forwards trusted `events` to SDK dispatch. The local launcher
loads optional private `eventConfigFile`, registers its dedicated access token as
a sensitive literal, and uses `bindMCPEvents` to compare client metadata with the
trusted task and verified principal. Starts precede dispatch; failed handlers or
invalid successful outputs cannot log success.
[Event boundaries](../../../docs/employee-events.md) preserve existing source
grants, domain logic and separate mandatory access/source audit.
