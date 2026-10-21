# Initial numerical and evidence controls

These labels were authored by Codex on 2026-10-21 under the maintainer's
authorization for a research-backed open-source baseline. They are provisional
mathematical and contract judgments, not qualified reservoir review or measured
field accuracy. All generated well histories are labeled `synthetic`.

The rate equation and finite integrals were checked against
[Equinor's technical report](https://equinor.github.io/decline-curve-analysis/dca_report.html)
(reviewed 2026-10-21). Its distinction between period totals and rates informs
the input contract. [EIA's 2020 method](https://www.eia.gov/analysis/drilling/curve_analysis/2020/)
(reviewed 2026-10-21) supports explicit observations, time normalization and
horizon choices; this implementation does not claim to reproduce that routine.

- Control: `type-curve.ts` constructs independent harmonic histories with initial
  rates 100/200 bbl/day, nominal decline 0.1 per declared 365-day year and b=1.
  The equal-well mean has five-year modeled volume `547500 * ln(1.5)` bbl.
- Independent volume oracle: tests integrate the rate equation using Simpson
  quadrature with 20,000 intervals and find the economic stop by bisection. They
  do not call the production integral/cutoff helper to obtain expected values.
  Closed-form exponential, harmonic and constant controls provide other checks.
- Edge cases: declared day/month/year conversion, zero/near-zero decline,
  near-zero/near-one exponent including subnormal values, finite b>1 horizons,
  cutoff behavior, invalid units/timing/identity, noisy and insufficient histories,
  unusable whole cohorts and nonrepresentable values.
- Authority: source/synthetic labels and revisions survive, model text cannot
  overwrite numbers or approve anything, unavailable uncertainty stays unavailable,
  and legacy identifier-only tier requests fail through the actual MCP client.

The committed fixtures and Git revision identify the labels used by the tests;
the tests do not mutate their expected values. #681 owns real-field cohort and
format qualification, broader fit/model selection, calibration and executing
employee review/source controls. #694 still requires named human MVP acceptance.
No test score is a percentage estimate of professional correctness.
