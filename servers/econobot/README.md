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

For source-backed employee work, set `ECONOBOT_CONFIG_FILE` to an owner-only
operator binding. It selects the exact task, seven financial source exports,
scenario definitions, current read/export rights and a separate enrolled reviewer.
See [financial inputs](docs/EMPLOYEE_INPUTS.md). Source identities are checked
against actual authorized bytes; missing or changed basis blocks the scenario.

Configured tools add `read_scenario_inputs`, paginated `read_scenario_source`,
`get_context_source_metadata`, `calculate_scenario`, `compare_scenarios`,
`draft_scenario`, `prepare_review`, `get_review_status` and `record_scenario`.
The human uses `examples/review.mjs` to inspect, approve, reject or request changes.
Installed qualification and current rights bind private storage to that exact
packet. Approval never commits capital or certifies the upstream fiscal model.

The independent [Economist employee](../../agents/economist/README.md) consumes
these same tools; other compatible agents can also use them. The server remains
usable without an employee, model key, orchestrator or warehouse. See
[deployment](docs/DEPLOYMENT.md) for source/archive checks and separate containers.
