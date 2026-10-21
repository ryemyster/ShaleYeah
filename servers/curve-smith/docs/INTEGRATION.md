# Calling the versioned Curve-smith tools

Use any client supporting the repository's pinned MCP (Model Context Protocol)
profile. `generate_type_curve` accepts the committed
[synthetic request](../examples/type-curve.json) as tool arguments. That file is
validated in the tests; it is not field data or an approved forecast.

Both numerical tools require `contractVersion: 0.1.0`, product and daily-rate
units, explicit `timeBasis`, finite `horizon`, `economicLimitRate`, ordered
`forecastTimes`, an `inputRef` and at least one `assumptionRefs` entry. Each
reference has an exact `id` and `revision`. Oil uses `bbl/day`; gas uses `Mcf/day`.
No other rate/volume unit or implicit gas/oil conversion is accepted.

Work is bounded to 64 wells, 1,200 observations per well and 601 forecast times.
The exponent is 0–2; nominal decline is 0–1,000,000 per declared period and the
finite horizon is at most 1,000,000 periods. These are computational bounds,
not recommendations about reservoir applicability.

`generate_type_curve` also requires a formation label and one of:

- `basis: { kind: "analog-history", bFactor, analogWells }`. Each well contains
  `wellRef`, `evidenceKind: "observed" | "synthetic"` and an `observations` array
  of `{ elapsedTime, rate }`. All histories use the request's common units/time.
- `basis: { kind: "scenario", initialRate, nominalDecline, bFactor }`. These are
  explicit assumptions, not observed analogs.

`calculate_eur` uses the same common fields plus top-level `initialRate`,
`nominalDecline` and `bFactor`; it takes no formation or `basis`. Its result is
finite modeled volume, not certified ultimate recovery. The
[method guide](HOW_IT_WORKS.md) defines time zero, integration and limits.

## Results and failures

The SDK wraps a successful calculation in `{ success: true, analysis, metadata }`.
Check `analysis.status` and `analysis.cumulativeProduction.status`: a valid
request with no usable analog cohort or nonrepresentable volume can return an
explicit unavailable analysis. Do not treat wrapper success as an available
forecast. Confidence metadata is unavailable for these tools.

Available type-curve results include each well's source/revision/evidence label,
fit diagnostics, interval and modeled volume, plus the equal-well forecast.
Uncertainty stays unavailable and professional acceptance stays false. Invalid
schema inputs are MCP tool errors. The retained old identifier-only/tier and
undeclared two-product EUR requests are rejected; clients must supply the actual
versioned contract. Reservoir Engineer caller adoption is tracked in #681.

`includeInterpretation: true` is optional on `generate_type_curve`. Host code
must separately configure synthesis. Its absence/failure is explicit and does
not alter the calculation. Credential and approval fields are not tool inputs.
The new tools return no human-approved state; external clients must preserve
that boundary rather than infer approval from a useful-looking explanation.
