# Curve-smith MCP server

Curve-smith provides explicit fixed-b Arps calculations, source-linked production
forecasts and observed fit/holdout diagnostics. It is an independent TypeScript
MCP tool server. The [Reservoir Engineer employee](../../agents/reservoir-engineer/README.md)
is one client; compatible external clients can use the same tools.

## Tools

| Surface | Behavior |
| --- | --- |
| `generate_type_curve` | Fit caller-supplied daily-rate histories with a declared fixed b, or calculate an explicit parameter scenario; retain source/synthetic labels and unavailable uncertainty |
| `calculate_eur` | Calculate finite modeled volume over a declared interval/cutoff; the historical tool name does not certify ultimate recovery or reserves |
| `read_forecast_inputs`, `read_forecast_source` | Discover current source identities and coverage, then retrieve bounded exact evidence pages |
| `calculate_forecast`, `compare_forecasts`, `draft_forecast` | Use the authorized task's history, operating basis and assumptions; preserve real diagnostics and blocked work |
| `get_context_source_metadata` | Recheck exact source access for retained employee context |
| `prepare_review`, `get_review_status`, `record_forecast` | Persist an exact unreviewed checkpoint, read current review state, and save only its qualified human-approved private forecast |

The first two tools are caller-supplied numerical utilities, not a trusted source
access boundary. The employee tools are available with explicit host-owned source
configuration. Human inspection/decision is a separate enrolled API, never a
model tool. See [employee inputs](docs/EMPLOYEE_INPUTS.md).

## Run and configure

From this directory:

```sh
pnpm install
pnpm build
pnpm type-check
pnpm lint
pnpm test
node dist/index.js
```

The default stdio entrypoint supplies numerical utilities without ambient model
credentials. Set `CURVE_SMITH_CONFIG_FILE` to an absolute private operator-export
binding to add the reviewed employee workflow. Private JSON source profile 0.2.0
preserves exact source bytes, revisions, scope, as-of time and usage policy.
Task/work/context records retain employee profile 0.1.0.

For protected HTTP, supply `CURVE_SMITH_HTTP_CONFIG_FILE` and run
`node examples/local-http.mjs`. That host configuration names the source binding,
access-token file and required event configuration. Tool identity/scopes and
source authority are enforced separately on each request. Keep secrets and
operator files outside the checkout with owner-only permissions.

## Review and limitations

A separately enrolled human reviews exact sources, operating assumptions, work,
context and evaluation revisions. Installed qualification must pass before
approval. The backend rederives forecast truth and rechecks current rights before
an idempotent private save, including after restart. Native client confirmation
and model prose grant no authority.

Finite modeled cohort volume is an equal-well mean; future-only quantities are
per well. Neither is observed cumulative production or certified reserves.
Unknown/missing/stale inputs and failed standards remain visible. This workflow
does not operate field controls, commit capital or publish work.

See [architecture](docs/ARCHITECTURE.md), [workflow](docs/HOW_IT_WORKS.md),
[development](docs/DEVELOPMENT.md), [testing](docs/LOCAL_TESTING.md),
[integration](docs/INTEGRATION.md) and [deployment](docs/DEPLOYMENT.md).
