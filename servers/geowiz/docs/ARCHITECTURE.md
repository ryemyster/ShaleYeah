# Architecture — @shaleyeah/server-geowiz

## Role

Tier 1 MCP tool server. Exposes 8 geological analysis tools over the MCP protocol. Has no knowledge of the agent layer — it only handles tool calls.

## Tool inventory

| Tool | Handler | LLM? | Data input |
|------|---------|------|-----------|
| `analyze_formation` | `performFormationAnalysis()` | ✅ `callLLM` | LAS well log |
| `process_gis` | `processEnhancedGIS()` | ✅ `callLLM` | GeoJSON, Shapefile, KML |
| `process_well_logs` | `processMultiFormatWellLog()` | ✅ `callLLM` | LAS, DLIS, WITSML |
| `assess_quality` | `assessDataQuality()` | ✅ `callLLM` | Any data source |
| `process_access_database` | `processAccessDatabaseData()` | ✅ `callLLM` | Access / MDB files |
| `process_document` | `processDocumentData()` | ✅ `callLLM` | PDF, Word, text |
| `process_seismic_data` | `processSeismicAnalysis()` | ✅ `callLLM` | SEG-Y seismic |
| `process_aries_database` | `processAriesAnalysis()` | ✅ `callLLM` | ARIES production databases |

Every tool calls `callLLM()` from `@shaleyeah/sdk` for synthesis. Each falls back to `deriveDefaultFormationProperties()` when the API key is absent or the call fails.

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

```
MCP tool call: analyze_formation { filePath, formations }
  → parseLASFile(filePath)           # local: las-parse.ts
  → analyzeLASCurve(curves)          # local: curve-qc.ts
  → callLLM(prompt with extracted data)
    → Claude: GeologicalAnalysis JSON
  ↘ fallback: deriveDefaultFormationProperties(formations, depth)
```

## LLM call locations

All in `src/index.ts`. Each handler constructs its own prompt from parsed data and calls `callLLM()` once. The local tool files in `src/tools/` are pure data processors — no LLM calls inside them.

## Exports consumed by agents/geologist/

`agents/geologist/` imports these functions directly (TypeScript, not over MCP) to avoid the transport overhead for in-process calls:

- `performFormationAnalysis()`, `processEnhancedGIS()`, `processMultiFormatWellLog()`
- `assessDataQuality()`, `processAccessDatabaseData()`, `processDocumentData()`
- `processSeismicAnalysis()`, `processAriesAnalysis()`
- `deriveDefaultFormationProperties()` — deterministic fallback, no LLM

## Dependencies

```
@shaleyeah/server-geowiz
  ├── @shaleyeah/sdk      (MCPServer, callLLM, domain types)
  ├── @turf/turf           (GIS spatial operations in gis-processor)
  ├── shapefile            (Shapefile parsing in gis-processor)
  └── xml2js               (KML/WITSML XML parsing)
```
