# @shaleyeah/server-market

Market is a Model Context Protocol (MCP) tool backend for dated commodity benchmarks and competitor observations. It returns supplied source values, explicit scenario assumptions, or unavailable fields. A model can explain the evidence in a separately labeled, unreviewed narrative.

## Start locally

Install the workspace dependencies using [Getting Started](../../docs/GETTING_STARTED.md). From this package:

```sh
pnpm build
pnpm start
```

The default transport is standard input/output (stdio), which a generic MCP client can launch as a child process. To use the compiled entry, run `node dist/index.js` with installed package dependencies. `pnpm start` uses that compiled entry.

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
| `MARKET_CONFIG_FILE` | Optional absolute private employee binding: task, exact source files, current grants, storage, audit, review and optional `modelConfigFile` |
| `DATA_PATH` | Shared MCP runtime's data-directory setting |

See [input records](docs/INPUTS.md), [EIA setup](docs/EIA_API_SETUP.md), [integration](docs/INTEGRATION.md), and [local tests](docs/LOCAL_TESTING.md). HTTP requires explicit identity/scope and required audit configuration from the [shared SDK](../../sdk/docs/http-access.md); setting `PORT` alone does not provide access policy.

## Employee scenarios and review

With `MARKET_CONFIG_FILE`, the backend also exposes `read_market_inputs`,
`read_market_source`, `get_context_source_metadata`, `calculate_market_scenarios`,
`draft_market_scenario`, `prepare_market_review`, `market_review_status` and
`record_market_scenarios`. These bind the assigned mandate, dated series and
commercial assumptions to an exact private scenario packet. Applicable gas
conversion, period alignment and scenario arithmetic run in code. Missing or
stale inputs block a complete packet.

The separate human review CLI requires installed qualification before approval.
Source rights and exact revision are rechecked before recording, including after
restart. No model tool can approve, and recording supplies no trading, contract,
bid or capital authority. See [employee configuration and review](docs/EMPLOYEE_WORKFLOW.md).

Optional model interpretation uses a pinned, owner-bound shared synthesis
profile, configured by `modelConfigFile` or host-injected `modelRuntime`.
Unconfigured interpretation stays unavailable; ambient `ANTHROPIC_API_KEY` does
not select an implicit model. Source values remain available independently.

Human reviewers own source rights and commercial suitability. Initial price and
approval fixtures are fictional technical references, without professional
acceptance or a production deployment claim.
