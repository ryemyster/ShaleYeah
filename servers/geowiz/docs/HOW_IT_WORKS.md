# How Geowiz Works — @shaleyeah/server-geowiz

## Plain language (12-year-old version)

Imagine you have a box of geology homework — well logs, maps, seismic files, databases — in a dozen different formats. Geowiz is the expert that opens every format, reads what's inside, and tells you what the rock looks like underground.

You give Geowiz a permitted file and choose an operation. Formation analysis
reads LAS curves and asks the explicitly configured model provider for a
structured draft. It returns the actual provider/model receipt with the result.
Missing keys, unavailable models and invalid output produce errors; it does not
invent replacement conclusions. Existing processor estimates and source support
still need professional qualification in #671.

Geowiz exposes nine domain tools and one profile-discovery tool. It maintains
HTTP session state and can write findings/artifacts. Geologist is a separate ADK
employee that chooses tools and requires confirmation before proposing a save.
The backend must independently enforce authority; model prose cannot approve work.

## Formation lifecycle

1. Geologist discovers and checks the public synthesis profile.
2. Protected MCP ingress verifies identity, scopes and access audit.
3. Geowiz checks customer/employee ownership, reads LAS and checks curves.
4. Its private Gemini/Anthropic runtime validates capabilities and bounded limits,
   resolves a dedicated secret reference, and calls the native provider SDK.
5. It validates structured output and returns the draft plus model metadata.

See the [tool inventory](ARCHITECTURE.md) and [provider setup](../../../docs/model-providers.md).
Other current tools use their existing processors without model calls.

### Transport modes

- **stdio** (default): pipe-based, used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT` is set with explicit access policy): independent `StreamableHTTPServerTransport` sessions on the configured bind. [HTTP access setup](HTTP_ACCESS.md) supplies identity/scopes/audit; Geologist's installed Python client resolves a dedicated private credential reference.

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
