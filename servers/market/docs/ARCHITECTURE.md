# Market backend architecture

This TypeScript MCP (Model Context Protocol) package exposes two query tools. The [Market Analyst](../../../agents/market-analyst/README.md) is a separate ADK/Python employee. This backend's source repair changes no employee reasoning loop.

| Module | Responsibility |
| --- | --- |
| `src/prices.ts` | Fixed EIA series selection, bounded HTTP retrieval, per-host cache and separate observation/retrieval metadata |
| `src/evidence.ts` | Strict host source/assumption records, declared permissions, units, dates, freshness and private-file loading |
| `src/analysis.ts` | Canonical source projections and separately validated advisory `callLLM` interpretation |
| `src/index.ts` | Public MCP schemas, host dependency binding and explicit private advisory exports |

The host chooses the source reader and model dependency. The default reader uses the private file named by `MARKET_SOURCE_FILE`; MCP arguments cannot select a source file, URL, credential or reviewer. Host source rights and review records are operator-attested, not independently certified.

`analyze_market_conditions` uses explicit host benchmark observations when supplied; otherwise it reads the intended EIA benchmark. Source-file assumptions stay separate. `competitive_analysis` reads exact company/market/metric records; missing or ambiguous records remain unavailable. A region query supplies interpretation context, not a measurement of every regional price.

Canonical metric values are assembled before model output. Strict JSON response schemas allow narrative text and known evidence IDs, not new metric fields. Unknown/cross-company references, malformed responses and provider failures leave interpretation unavailable. The source snapshot/rights and observation age are rechecked after asynchronous interpretation.

EIA observations are cached for one hour, with original retrieval time and observation period preserved. Cache use checks current credentials; changing/removing the key invalidates its cache. Caller mutation cannot change cached data. Observation age is assessed on every use.

An explicit `outputPath` creates a new owner-private advisory file. Existing paths and links are rejected. Recording an unreviewed report supplies no commercial, bid, acquisition or capital approval.

The runtime depends on the installed `@shaleyeah/sdk` and Zod packages, not another employee's implementation. Stdio works as a local child process. HTTP uses the SDK's explicit access/audit configuration; see [deployment](DEPLOYMENT.md).
