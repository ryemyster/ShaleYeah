# Integrating the Market backend

The two MCP tool names remain `analyze_market_conditions` and `competitive_analysis`. A generic MCP client can call them over stdio; the separate [Market Analyst adapter](../../../agents/market-analyst/docs/INTEGRATION.md) uses protected HTTP when its host is configured.

```json
{"commodity":"both","region":"Permian","timeframe":"current"}
```

```json
{"competitors":["Your operator name"],"market":"Permian","metrics":["market_share","production","costs"]}
```

The first query goes to `analyze_market_conditions`; the second goes to `competitive_analysis`. Company names select source records, not estimates. Query arguments cannot contain records, source-file paths, reviewer identities or provider keys. `outputPath` is optional and creates a new private advisory file; `matchThreshold` remains a query compatibility field, not an evidence-confidence score.

The shared MCP envelope's `success` describes whether the query executed. Read the analysis/profile availability and detailed source fields to determine whether market evidence exists. Empty source data can produce a successful query with an unavailable analysis.

| Result | Meaning |
| --- | --- |
| `current.oil.price` / `current.gas.price` | Eligible observed benchmark value, otherwise `null` |
| `current.*.observation` | Detailed value, status, source period, retrieval time, unit and reason; a stale original value remains visible here |
| `current.*.assumptions` | Explicit host-reviewed scenario values; never observed current prices |
| `competitors[].production`, `avgCosts`, `marketShare` | Eligible requested observations, otherwise `null` |
| `competitors[].metrics` | Source/assumption details; unrequested fields say `not_requested` |
| `interpretation` | Advisory model summary, known evidence IDs, limitations, unreviewed status and no commercial authority |

Requesting `gas` excludes the oil output. Competitor scope uses exact company names and canonical market spelling; ambiguous records remain unavailable. `timeframe` is interpretation context, not a generated price history or forecast. The model is not a factual data provider.

Host observations use [the private source format](INPUTS.md). In TypeScript integrations, `createMarketTemplate({readSources, prices, llm, clock, maxObservationAgeSeconds})` can bind trusted providers without exposing those dependencies as tool parameters. The default `llm` uses the existing shared `callLLM` function.

The caller must preserve `null`, source dates, status and assumption labels. Human approval and professional suitability are separate from a tool response. No observation, source-rights attestation or narrative authorizes a bid, acquisition or capital commitment.
