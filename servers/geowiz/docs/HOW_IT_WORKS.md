# How Geowiz Works — @shaleyeah/server-geowiz

## Plain language (12-year-old version)

Imagine you have a box of geology homework — well logs, maps, seismic files, databases — in a dozen different formats. Geowiz is the expert that opens every format, reads what's inside, and tells you what the rock looks like underground.

You give Geowiz a file path and ask a question. It figures out what kind of file it is, reads the data, then asks Claude (the AI) to explain what the numbers mean for that specific formation. If the AI isn't available, Geowiz falls back to its own built-in rules to give you a reasonable answer anyway.

It doesn't remember anything between calls — every request is fresh. It just reads, thinks, and answers.

## Technical explanation

Geowiz is a **Tier 1 MCP tool server** — a stateless process that exposes 9 geological analysis tools over the Model Context Protocol. It has no knowledge of agents, sessions, or business logic. Its only job is: receive tool call → parse data → call LLM → return structured result.

### Request lifecycle

```
Agent (geologist)
  → MCP tool call: analyze_formation { filePath, formations }
      ↓
  Geowiz server (src/index.ts)
      ↓
  1. Route to handler: analyze_formation
  2. parseLASFile(filePath)           → las-parse.ts
  3. analyzeLASCurve(curves)          → curve-qc.ts
  4. Build prompt with extracted data
  5. callLLM(prompt)                  → @shaleyeah/sdk → Anthropic API
     OR fallback: deriveDefaultFormationProperties(formations, depth)
  6. Return GeologicalAnalysis JSON
      ↓
  Agent receives result
```

### Tool inventory

| Tool | What it does | Input formats |
|------|-------------|---------------|
| `analyze_formation` | Identifies lithology, porosity, permeability from well log curves | LAS 2.0 |
| `process_gis` | Extracts acreage, tract boundaries, spatial relationships | GeoJSON, Shapefile, KML |
| `process_well_logs` | Multi-format dispatch: routes to the right parser | LAS, DLIS, WITSML |
| `assess_quality` | Scores data completeness, flags anomalies | Any |
| `process_access_database` | Reads tables from old-school petroleum databases | Access (.mdb, .accdb) |
| `process_document` | Extracts text and tables from reports | PDF, Word, text |
| `process_seismic_data` | Parses trace headers and amplitude data | SEG-Y |
| `process_aries_database` | Reads production history and well metadata | ARIES |
| `save_finding` | Persists a key geological finding to `./data/geowiz/findings/` as JSON | JSON payload |

### LLM + fallback pattern

Every tool handler follows the same pattern:

```typescript
try {
  return await synthesizeGeologyWithLLM(input);
} catch (_err) {
  // LLM unavailable — return deterministic rule-based result
  return deriveDefaultFormationProperties(formations, depth);
}
```

The fallback uses domain constants (typical GR ranges, porosity rules for known formations) — never random values. This means the server always returns a useful result even with no API key.

### Transport modes

- **stdio** (default): pipe-based, used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT` is set): `StreamableHTTPServerTransport` on the given port — used by the agent fleet

The transport is selected at startup in `MCPServer` (from `@shaleyeah/sdk`) based on whether `process.env.PORT` is set. No code change is needed in the server itself.

### Data processor architecture

The 8 format-specific parsers in `src/tools/` are loaded as **dynamic imports** inside their tool handlers. This keeps server startup fast — a caller that only uses `analyze_formation` never loads the SEG-Y or ARIES parsers.

```
src/tools/
  las-parse.ts           # synchronous, used in the hot path
  curve-qc.ts            # quality control for LAS curves
  gis-processor.ts       # turf.js spatial analysis
  well-log-processor.ts  # multi-format dispatch
  access-processor.ts    # MDB/ACCDB table extraction
  document-processor.ts  # PDF + Word extraction
  seismic-processor.ts   # SEG-Y binary parsing
  aries-processor.ts     # ARIES production DB
  witsml-processor.ts    # WITSML XML format
```
