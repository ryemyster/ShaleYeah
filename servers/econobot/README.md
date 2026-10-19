# Econobot — explicit cash-flow calculations

Econobot compares money paid out with money received over equal periods. It
calculates net present value (NPV), internal rate of return (IRR), and the first
period-end at which the initial investment is recovered. The human supplies the
cash flows and assumptions and reviews the result before making a decision.

Run package checks from `servers/econobot`:

```sh
pnpm build
pnpm type-check
pnpm lint
pnpm test
pnpm start
```

The default server uses standard input/output and needs no model key. Connect
with an MCP client supporting the pinned 2026-07-28 profile. For authenticated
HTTP, a host must enroll identity, scopes and audit through the
[shared access guide](../../sdk/docs/http-access.md); setting PORT alone is
insufficient.

Call `calculate_dcf` with this complete example:

```json
{
  "contractVersion": "0.1.0",
  "cashFlows": [-100, 39, 59, 55, 20],
  "discountRate": 0.1,
  "currency": "USD",
  "periodUnit": "year",
  "inputRef": {"id": "operator.cash-flows", "revision": "r1"},
  "assumptionRefs": [{"id": "operator.assumptions", "revision": "r1"}]
}
```

The first cash flow occurs now; later entries occur at the end of each declared
period. Expenses are negative and receipts positive. The discount rate and IRR
are decimal rates per that same period. A monthly rate is never silently treated
as annual. References identify the supplied revision; these labels do not prove
its authorization or professional approval.

Each metric has `status` and `value`. Unavailable values are null with a reason.
IRR may be unavailable for an all-zero, same-sign, non-conventional or
unconverged series. Numerical availability never approves an investment.
See [calculation rules](docs/HOW_IT_WORKS.md) for bounds and limitations.

| Tool | Input | Output |
| --- | --- | --- |
| calculate_dcf | Explicit contract above | NPV, IRR, payback and conventions |
| analyze_economics | `{input: <contract>, includeInterpretation?: boolean}` | Same calculations plus separate unreviewed interpretation status |
| sensitivity_analysis | `{baseCase: <contract>, scenarios: [{id, input: <contract>}]}` | Calculations for each supplied scenario in the same currency/period |

Optional interpretation requires host configuration through
`createEconobotTemplate({synthesis: {model, apiKey}})`. It uses the existing
shared `callLLM` adapter, stays separate from numerical truth and returns an
explicit unavailable state on failure. The default CLI does not enable it.

The request and output shapes replace the old inferred spreadsheet API. Legacy
price/cost/production files, bare cash-flow arrays without units/references,
percentage IRR scalars, invented breakeven/confidence and generated price
scenarios are unsupported. The [Economist migration](https://github.com/ryemyster/ShaleYeah/issues/680)
will adopt this contract; its current TypeScript wrapper is not a qualified
employee workflow. Data ingestion must prepare explicit cash flows before
calling these tools.
