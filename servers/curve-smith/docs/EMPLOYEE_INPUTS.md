# Source-bound production forecasts

The forecast tools reconcile an operator's normalized production history,
well/completion identity and operating basis with explicitly declared fixed-b
Arps alternatives. They return modeled quantities and observed validation
diagnostics for human review. They do not classify reserves or authorize field
operations or capital spending.

The native employee grades actual returned work against current backend evidence
and independent synthetic references. Source, wheel and production archive
qualification exercises exact human review and restart. Container support requires
the separate passing Linux image/journey report from required CI. These controls
do not establish field accuracy or professional acceptance.

## Input contract

Each task binds exactly three current source artifacts: production history,
operating basis, and forecast assumptions. Sources use the existing JSON source
profile `0.2.0`; task, work and context records retain employee profile `0.1.0`.
Each artifact carries exact-byte SHA-256, revision, as-of time, scope, task
revision, usage policy and source identity. Required fields are defined in
`src/forecast-service.ts`.

- History declares formation, product, daily rate unit (`bbl/day` or `Mcf/day`),
  a fixed day/month/year time conversion, `calendar-elapsed` time convention,
  `well` source grain and `instantaneous-rate` observations. Each well declares
  a completion revision, origin, observed/synthetic evidence label and strictly
  increasing observation times with matching dates. Rates must be positive and
  observations explicitly marked producing. Shut-ins, period totals and missing
  observations need an explicitly qualified mapping before use; this path rejects
  them rather than silently interpolating or dropping them.
- Operating basis repeats the exact formation, product, units, time basis and
  well/completion identities, and declares the operating assumptions and
  limitations. A lease or annual total cannot become a single-well monthly series.
- Assumptions declare each alternative's ID/revision, fixed b, finite horizon,
  economic cutoff, forecast grid, fitting cutoff, minimum training/holdout counts,
  and maximum training/holdout relative RMSE. These standards have no silent
  defaults. b=0 is exponential, b=1 harmonic; intermediate and supported b>1
  alternatives remain explicit assumptions, not inferred reservoir properties.

Fitting uses only observations through the declared fitting cutoff. Later
observations form the holdout set and cannot influence fitted parameters.
Relative RMSE uses the maximum training rate as its scale. Missing fits or
holdouts produce unavailable diagnostics and failed configured quality. Training
and holdout counts report actual observations even when fitting is unavailable.

The modeled cohort volume is the **equal-well mean** from time zero to the
declared horizon or economic cutoff, not a field total or observed cumulative
production. Remaining volumes are reported separately for each well, starting at
its last observation and ending at the modeled stop. All integrals use the
declared daily-rate/time conversion. There is no calibrated uncertainty model;
uncertainty stays unavailable. Full assumptions and limitations remain in the
forecast packet, with source-linked summaries in the work product.

## Local operator exports

Build with `pnpm build` in this package. The independent entrypoint accepts
`CURVE_SMITH_CONFIG_FILE=/absolute/private/binding.json node dist/index.js`.
The host-owned binding specifies:

- `version: "0.1.0"`, `sourceAuthority: "operator-attested-export"`, and the
  qualification label; labeling a run `live` does not qualify it.
- The task and its `historySourceRef`, `basisSourceRef`, `assumptionsSourceRef`.
- Three `sources`, each with an absolute private `file` path and complete JSON
  source `artifact` envelope. The SDK private-file reader checks ownership,
  permissions, type, link count, size, UTF-8 and file stability. The forecast
  boundary verifies the bytes against the declared artifact hash and length.
- `sourceGrant` with subject, permitted source IDs, expiry and revocation, plus
  `sourceOperations` selecting read/export. The enrolled local UID and subject
  are separate from model arguments. Sources also require `source:read` and
  `reservoir:read` scopes.
- `maxSourceAgeSeconds`, `maxObservationAgeSeconds`, a private state directory,
  audit file, correlation IDs and secret files to exclude from content.
- Optional review policy, enrolled reviewer and installed qualification config.
  Missing installed qualification cannot be replaced by claimed passing evals.

See `src/configuration.ts` for the strict binding schema. It rereads current
grants and policy; source/task/configuration changes invalidate an existing
binding. The binding attests upstream source rights locally. Hosted integrations
must inject their trusted current authority and verified JSON source snapshots
through `ProductionForecastService`; no government/vendor API or redistribution
right is certified by this adapter.

## Review and private save

Employee tools read source pages, calculate, compare, draft and prepare an exact
review checkpoint. An independently enrolled human uses `examples/review.mjs`
to inspect the complete packet and approve, reject or request changes. The human
decision API is not a model tool.

The backend rederives work and forecasts from current sources, binds exact
context/evaluation/action revisions and requires installed qualification before
approval. Only a bound approved grant permits `record_forecast`, an idempotent
private save. Changed/revoked evidence, forged approval, wrong context and replay
against another revision fail. Native ADK confirmation remains an interaction
step; it cannot supply this business approval.
