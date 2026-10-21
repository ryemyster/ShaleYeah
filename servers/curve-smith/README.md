# @shaleyeah/server-curve-smith

Curve-smith supplies calculation tools for Lucius Technicus Engineer, the
Reservoir Engineer employee. It is an MCP (Model Context Protocol) server: an
agent or another compatible client sends a request and receives structured data.

The versioned tools use supplied daily production rates or explicit model
parameters. A type curve is a representative production forecast for a group of
wells. Its volume is the area under the modeled rate curve over a declared period.

| Tool | Current behavior |
| --- | --- |
| `generate_type_curve` | Fit each supplied analog history using an assumed Arps exponent, then average the well forecasts; alternatively calculate an explicit scenario |
| `calculate_eur` | Calculate finite modeled volume from explicit parameters, units, horizon and rate cutoff |
| `analyze_decline_curve`, `assess_curve_quality` | Older file-fitting/quality paths; broader fitting, units and quality judgments await [Reservoir Engineer qualification](https://github.com/ryemyster/ShaleYeah/issues/681) |

EUR means Estimated Ultimate Recovery. The retained `calculate_eur` tool name
does not make its result an ultimate recovery or reserves classification. The
result reports `volumeBasis: modeled-from-declared-time-zero`, with no observed
production added. Oil and gas are calculated separately in barrels or Mcf
(thousand cubic feet); there is no assumed gas/oil conversion.

Routine calculations may run automatically. A human must review source rights,
well comparability, units, assumptions and engineering applicability before
business reliance. Results are always unreviewed and cannot certify reserves.
Statistical uncertainty is unavailable; there are no invented percentile or
confidence values. Source references identify caller-supplied inputs and do not
prove source approval. See [method and limits](docs/HOW_IT_WORKS.md).

## Quick start

After [workspace setup](../../docs/GETTING_STARTED.md), run from the repository root:

```sh
pnpm --dir servers/curve-smith build
pnpm --dir servers/curve-smith start
```

With `PORT` unset this starts the stdio transport. Any client supporting the
repository's pinned MCP profile can call it. Use the [versioned request
example](examples/type-curve.json) and [integration guide](docs/INTEGRATION.md).

## Verification

```sh
pnpm --dir servers/curve-smith type-check
pnpm --dir servers/curve-smith lint
pnpm --dir servers/curve-smith test
pnpm --dir servers/curve-smith test:coverage
```

Tests use explicitly synthetic histories, independent numerical integration,
actual tool handlers and an independent stdio client. They require no live key.
The coverage command requires 90% for the repaired Arps, type-curve and narrative
modules. It does not qualify the older file-fitting module or professional
accuracy. [Fixture evidence](tests/fixtures/README.md) records the initial labels.

## Environment

| Variable | Purpose |
|----------|---------|
| `PORT` | Optional HTTP transport; stdio when unset |
| `ANTHROPIC_API_KEY` | Used by the older file-analysis interpretation path; not required for versioned numerical tools |

For versioned type-curve interpretation, host code explicitly configures
`CurveSmithServer({ synthesis: { apiKey, model } })` and the request sets
`includeInterpretation: true`. Credentials are host settings, never tool inputs.
The optional model receives a numerical summary, with no raw histories or source
identifiers. Its answer remains unreviewed text and cannot change calculations,
uncertainty or approval. See [deployment](docs/DEPLOYMENT.md).
