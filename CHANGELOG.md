# Changelog

This log separates changes awaiting a merge to `main` from changes already in
`main`. Detailed implementation history remains in the linked issues, pull
requests and [previous full changelog](https://github.com/ryemyster/ShaleYeah/blob/07d0efc5a97c1e0f1e126c974bac5a3a3e4ed7ac/CHANGELOG.md).

## [Unreleased]

Changes after the latest `main` merge. The remaining employee migrations and
MVP acceptance work are tracked in the [delivery plan](docs/mvp-release-plan.md).

### Added

- **Employee contracts and delivery plan:** independently installable task,
  evidence, context and review contracts; role charters; separate BYO model-key
  and external-agent requirements; ordered issue-to-develop delivery commands
  and Git guards. (#567, #568, #571–#573, #664, #665, #675, #696, #698)
- **Configurable evaluations:** versioned profiles and frozen datasets, independent
  financial checks, observed QA results, and required reference qualification.
  Technical fixture results and professional acceptance are recorded separately.
  (#577, #666, #667, #711, #716)

### Changed

- **Market Analyst employee:** exact mandate/series/assumption exports, independent
  time-series and unit checks, native configured providers, private retained context,
  actual-output grading and installed qualification before separate human review.
  Recording binds the exact scenario packet and remains idempotent after restart.
  Retained advisory queries use configured synthesis with owner checks; obsolete
  global wrappers and inline evals are removed. Market has a required native,
  external-tool, source/archive/wheel and container CI job; six callers remain.
  Fictional prices and provisional labels establish no commercial accuracy,
  licensed-feed entitlement, professional acceptance or transaction authority. (#684)

- **Market source repair:** missing/failed EIA access leaves unavailable prices;
  source periods, units and retrieval times remain distinct. Host-selected private
  observations and reviewed scenario assumptions replace name-derived competitor
  metrics. Shared model interpretation stays advisory and cannot populate factual
  fields. Unsupported forecasts, volatility and confidence defaults are removed;
  key-scoped caches and exclusive private exports preserve the source boundary.
  Volatile key handles and cache generations reject cleared in-flight work;
  export tests inspect the same open file handle after denied writes.
  The employee workflow is adopted separately in #684. (#708)

- **Legal Analyst employee:** exact matter/corpus/checklist sources, backend-computed
  UTF-8 citations, declared scope/effective-date eligibility and explicit question/
  source/conflict coverage. Native configured providers, retained private context,
  actual-output grading, installed qualification and enrolled human review bind
  the exact private memo. Default risk/cost/timeline derivations, keyword rules,
  silent LLM fallbacks and old wrapper/eval paths are removed. Legal has its own
  required native, trace and artifact CI job; seven caller wrappers remain.
  Citation validity and fixture qualification do not establish legal entailment,
  professional licensing, acceptance or clearance. (#683)

- **Risk Analyst employee:** exact register/policy/joint-scenario sources,
  durable native context, independent actual-output checks, enrolled human
  review and installed qualification before private recording. The initial
  deterministic method discloses assumptions and preserves policy blockers;
  unsupported scores, financial proxies, unseeded sampling and caller-selected
  writes are removed. Risk now has required native/package/container CI gates.
  Shared caller controls now cover the eight remaining wrappers; Risk's
  protected external-tool controls belong to its native employee package.
  Fixture success does not establish field calibration or professional acceptance. (#682)

- **CI fixture maintenance:** Reporter configuration/HTTP bootstrap controls
  create current synthetic grant/evidence dates when running against the real
  clock. Fixed-clock review fixtures and production expiry checks remain intact.
  This repairs a workspace gate exposed while qualifying #681.

- **Independent packages:** separate specialist agents and MCP tool servers in
  the monorepo, ADK/Python agent authoring, and package-local setup, source/wheel/
  archive exports and container verification. Orchestration remains optional.
  (#385, #498, #527–#543, #578, #597, #674, #679)
- **Reviewed employee workflows:** Geologist, Reporter, QA, Economist and Reservoir Engineer now have
  source-bound private context, configurable scorecards, human review and
  restart/resume paths. Displaced TypeScript agent paths were removed for these
  migrations. Reservoir binds exact production/basis/assumptions exports to
  finite forecasts, independent synthetic numerical checks and qualified human
  private-save review. Required CI includes its native, package and container
  journeys. (#541, #542, #669, #671–#674, #680, #681)
- **MCP interoperability and trust:** stateless MCP 2026-07-28 clients, explicit
  identities/scopes, schema and error validation, bounded discovery/preflight retries,
  cancellation, current source grants and redacted correlated events.
  (#574, #668, #670, #677–#679, #722)
- **Contributor and CI workflow:** package-local verification, isolated reference
  checks, required native trace grading, affected-unit PR qualification, early
  workspace feedback and full merge/manual checks with serialized workspace
  tests on the constrained runner. (#498, #674, #680, #744, #754)

### Fixed

- **Employee context:** shared dependencies are checked once per authorization
  phase, with fresh checks across delivery boundaries. Exports validate captured
  task/checkpoint/record metadata after the final authority await and reject
  expired, changed, corrupt or rebound content. (#755, #757)
- **Source and numerical fidelity:** replace geological guesses, invented
  confidence, estimated QA passes, fabricated economic results and type-curve
  percentiles with observations, unavailable states and independently checked
  calculations.
  (#671, #710–#712, #716)
- **SDK and runtime safety:** bounded fenced-JSON parsing, explicit protocol/tool
  failures, current checkpoint lineage and removal of the anonymous job poller.
  (#571, #677, #680, #722)

## In main — 2026-04-17

Verified at [merge commit 6a23be1](https://github.com/ryemyster/ShaleYeah/commit/6a23be132ee099cb48f566a7f31d3549c80cf40c)
([PR #291](https://github.com/ryemyster/ShaleYeah/pull/291)). This snapshot has no
version tag; the former provisional `2.1.0 — TBD` heading has been retired.

- Kernel execution, dependency hints, resource references, canonical data,
  session persistence, caching, circuit breakers, retries, cancellation and
  partial-result handling were already merged.
- Shared LLM integration, EIA access, Monte Carlo sampling, demo fixture handling
  and the associated documentation/security changes were already merged.
- The recorded `2.0.0` history and full main-branch notes are preserved in the
  [changelog at that merge](https://github.com/ryemyster/ShaleYeah/blob/6a23be132ee099cb48f566a7f31d3549c80cf40c/CHANGELOG.md).
