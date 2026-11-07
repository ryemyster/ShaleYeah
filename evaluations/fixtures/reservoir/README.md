# Frozen Reservoir metric controls

These package-owned test inputs let the installed evaluation wheel run outside
the monorepo. `forecast-oracles.json` records eight independently authored,
known-parameter synthetic references. `observed-forecasts.json` records separately
captured backend outputs. Tests change outputs to prove the independent rate,
quadrature, diagnostic, unit and authority checks reject incorrect work.

The initial bytes match the role's provisional #681 reference revision r1,
authored by Codex under the maintainer's research authorization on 2026-11-06.
They are retained here as evaluation-package test data, without importing or
requiring the employee app. The role retains its own hash-bound dataset and
fixture copies for independent employee packaging. CI never regenerates labels
or copies live repository outputs over these controls.

The mathematical rationale is Equinor's technical decline-curve report:
https://equinor.github.io/decline-curve-analysis/dca_report.html . EIA's method
distinguishes observed production, normalization and extrapolation:
https://www.eia.gov/analysis/drilling/curve_analysis/2020/ . These controls do not
implement EIA's monthly-total routine, establish field accuracy or classify
reserves. Changes require explicit fixture review; retain prior results and the
role's separate fixture/version history.
