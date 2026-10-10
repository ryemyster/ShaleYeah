# Architecture — @shaleyeah/server-geowiz

## Role

Tier 1 MCP tool server. Exposes 9 domain tools and one model-profile discovery tool over the MCP protocol. Has no knowledge of the agent layer — it only handles tool calls.

## Tool inventory

There are nine domain operations and one discovery operation. Only formation
analysis currently uses a model. Other processor outputs still need source and
format qualification; a successful RPC does not certify their professional quality.

| Tool | Model use |
| --- | --- |
| `analyze_formation` | Injected Gemini/Anthropic structured synthesis |
| `get_model_profile` | Public binding discovery without secret references |
| `process_gis`, `process_well_logs`, `process_access_database` | Existing processors; no model call |
| `process_document`, `process_seismic_data`, `process_aries_database` | Existing processors; no model call |
| `assess_quality` | Existing fixed metrics; input-derived repair is #671 |
| `save_finding` | File write; caller needs independent authorization/review |

## Local tools (src/tools/)

Private to this package — not re-exported, not part of the public API.

| File | Purpose |
|------|---------|
| `las-parse.ts` | Synchronous LAS 2.0 parser used by the inline formation analysis path |
| `curve-qc.ts` | Curve quality control — flags flat lines, spikes, noisy curves |
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
parses LAS, performs curve checks, and invokes its private native SDK runtime.
Structured output is validated and returned with provider/model revisions.
Missing configuration, provider errors and invalid outputs remain failures.

The injected runtime is captured in each server's tool template before the SDK
factory constructs/registers capabilities. Each analysis gets a fresh bounded
synthesis budget; no global key or vendor default is consulted. Nonmodel tools
remain usable without a model key. [Provider setup](../../../docs/model-providers.md)
explains the contract and limits; [HTTP access](HTTP_ACCESS.md) explains authority.

`deriveDefaultFormationProperties` remains a legacy utility export under #671;
it is no longer a production synthesis fallback. Other parser estimates and
source placeholders are not qualified by the provider fixture tests.

## Dependencies

```
@shaleyeah/server-geowiz
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
