# Provisional joint-scenario controls

The five synthetic reference cases in `joint-scenario-oracles.json` were authored
by Codex on 2026-11-09 under the maintainer's initial-research authorization,
before the TypeScript calculator. Counts and joint-state weights are explicit;
the mean, centered variance, loss-CDF quantiles, tail mass and indicator
correlations are independently checkable. Large weights and a large loss baseline
with variance one guard against cancellation. A zero-weight state cannot remove
a severe risk from the register's separate policy coverage.

These package-owned fixtures run with the installed evaluation wheel without
employee, model, MCP or server source. Backend tests retain their own frozen copy
for standalone use. Neither CI nor the evaluator regenerates these labels from
the current backend. Changes need an explicit reviewed reference revision with
previous results retained; do not silently update labels to pass tests.

References and versions inspected 2026-11-09:

- [HM Treasury Orange Book](https://www.gov.uk/government/publications/orange-book/the-orange-book-management-of-risk-principles-and-concepts):
  explicit assumptions, dependencies, uncertainty and accountable risk ownership.
- [AQuA Book, 2025 edition](https://www.gov.uk/guidance/the-aqua-book): verification,
  validation and independent reference cases.
- [NumPy 2.5 quantile definition](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html):
  weighted empirical CDF with the inverted-CDF convention. P10/P50/P90 here are
  ascending loss quantiles, not petroleum-reserves exceedance categories.

These references support the method and assurance practice. They do not calibrate
petroleum probabilities, establish asset materiality, provide legal advice or
certify field accuracy. Probabilities/losses remain source-bound assumptions,
and a separately enrolled human retains residual risk acceptance.
