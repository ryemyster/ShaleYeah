# @shaleyeah/server-market

Market is a Model Context Protocol (MCP) tool backend for dated commodity benchmarks and competitor observations. It returns supplied source values, explicit scenario assumptions, or unavailable fields. A model can explain the evidence in a separately labeled, unreviewed narrative.

## Start locally

Install the workspace dependencies using [Getting Started](../../docs/GETTING_STARTED.md). From this package:

```sh
pnpm build
pnpm start
```

The default transport is standard input/output (stdio), which a generic MCP client can launch as a child process. To use the compiled entry, run `node dist/index.js` with installed package dependencies. The source entry used by `pnpm start` needs the package's development dependencies.

## Tools

| Tool | Query | Source result |
| --- | --- | --- |
| `analyze_market_conditions` | `commodity`, `region`, optional `timeframe` | WTI/Henry Hub benchmark observations, source dates and explicit assumptions |
| `competitive_analysis` | `competitors`, `market`, optional `metrics` | Source-backed market share, production and costs for the requested companies/market |

A missing value is `null`. Read its detailed observation/metric `status`, `reason`, `observedAt`, `retrievedAt`, `source` and `review`. Assumptions keep their own values and review metadata; they never populate observed current-price or company-metric fields. Numerical zero remains zero. Model summaries live under `interpretation`, with `reviewStatus: "unreviewed"` and `commercialAuthority: false`.

## Host configuration

The process reads environment variables; it does not automatically load an `.env` file. Set them through a private process environment or an owner-private environment file, for example `node --env-file=/absolute/private/market.env dist/index.js` after building. Keep real credentials out of version control.

| Variable | Purpose |
| --- | --- |
| `EIA_API_KEY` | Optional Energy Information Administration (EIA) access for the two daily benchmarks; absent/failed access leaves unavailable fields |
| `MARKET_SOURCE_FILE` | Optional absolute path to an owned private JSON file containing permitted observations and reviewed scenario assumptions |
| `MARKET_MAX_OBSERVATION_AGE_SECONDS` | Analysis freshness policy; defaults to 604800 seconds (seven days), accepts integers from 1 to 31536000 |
| `ANTHROPIC_API_KEY` | Optional shared `callLLM` interpretation access; missing/failed model access leaves source data intact and interpretation unavailable |
| `DATA_PATH` | Shared MCP runtime's data-directory setting |

See [input records](docs/INPUTS.md), [EIA setup](docs/EIA_API_SETUP.md), [integration](docs/INTEGRATION.md), and [local tests](docs/LOCAL_TESTING.md). HTTP requires explicit identity/scope and required audit configuration from the [shared SDK](../../sdk/docs/http-access.md); setting `PORT` alone does not provide access policy.

This backend provides advisory evidence. Human reviewers own source rights, commercial suitability and consequential decisions. Market Analyst's full employee workflow and qualification are tracked separately in #684.
