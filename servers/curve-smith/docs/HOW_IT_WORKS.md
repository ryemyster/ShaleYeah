# How the versioned production tools work

A production rate describes how much a well produces per day. A production
volume describes how much was produced over a period. The versioned tools accept
instantaneous rates, not monthly totals. Converting reported totals, checking
uptime and choosing comparable wells are upstream engineering tasks.

## Declared model and time

Arps is a family of declining rate curves:

`q(t) = qi * (1 + b * D * t)^(-1/b)`

At b=0 its continuous limit is `qi * exp(-D*t)`. Here `qi` is the initial daily
rate, `D` is nominal decline per declared time unit, and `b` is the exponent.
The request declares a fixed day/month/year basis and its `daysPerUnit`. A day
must equal 1 day; fixed months accept 28–31 and fixed years 360–366 days. These
are explicit conventions, not automatic calendar/producing-time conversions.

The numerical kernel integrates only from declared time zero to the earlier of
the finite horizon and economic rate cutoff. The cutoff uses the same rate unit
as `qi`; zero means no early rate stop. A starting rate at/below the cutoff gives
zero modeled volume. Zero decline gives a constant-rate integral.

For b other than 0 or 1, the integral before daily-rate conversion is:

`qi * ((1 + b*D*T)^((b-1)/b) - 1) / ((b-1)*D)`

The b=1 limit is `qi * ln(1+D*T)/D`; b=0 uses
`qi * (1-exp(-D*T))/D`. The implementation uses continuous `log1p`/`expm1`
ratios to preserve small differences and subnormal limits. Multiply the
rate/time integral by declared days per unit to obtain bbl or Mcf. A finite
horizon is required even for b>1; no infinite-tail recovery is claimed.

## Analog histories and scenarios

For `basis.kind: analog-history`, each well supplies an exact source identity,
revision, observed/synthetic label and at least three positive rate observations.
Elapsed times start at zero, strictly increase and stay within the horizon.
The caller explicitly chooses b and references that assumption.

Each well is fit separately by unweighted least squares in transformed-rate
space: log-rate for b=0, an affine transformation of rate to power -b otherwise.
This estimates `qi` and nominal `D`, while keeping b fixed. It does not select the
best model or estimate b. The result includes observation count, daily-rate root
mean squared error and descriptive rate-space R-squared. R-squared is unavailable
for a constant series and never becomes a confidence or approval score.

The type curve is the equal-well mean of the individual fitted forecasts and
finite volumes. Unequal history lengths do not silently change each well's
weight. The mean is not presented as one fitted Arps curve. Each well's fitted
parameters, modeled interval and volume remain visible. If any well is unusable,
the whole-cohort forecast is unavailable; usable wells are not silently selected.

For `basis.kind: scenario`, explicitly supplied `qi`, `D` and b drive the same
kernel. Its evidence label is assumptions-only. Empty analog history does not
turn into a scenario. Observed labels remain caller-supplied source claims;
synthetic labels are preserved. Numeric overflow/underflow that prevents a
representable volume produces an unavailable result.

## Interpretation and limits

A separately configured model can explain a numerical summary. It receives no
raw histories, formation text or source identifiers. Its output is unreviewed
text; it cannot replace calculations, provenance, uncertainty or authority.
Provider failure leaves the calculation available and interpretation unavailable.

Uncertainty is explicitly unavailable. No statistical error model, population
sampling justification or cumulative-volume percentile method has been qualified.
[EIA's published example](https://www.eia.gov/analysis/drilling/curve_analysis/2020/)
shows why observations and time/horizon choices matter.
[Equinor's technical report](https://equinor.github.io/decline-curve-analysis/dca_report.html)
provides finite integrals and distinguishes pointwise rate uncertainty from
uncertainty in cumulative volume. Neither source certifies this implementation's
field accuracy. Initial synthetic labels are recorded in the
[fixture evidence](../tests/fixtures/README.md).

The older `analyze_decline_curve` and `assess_curve_quality` paths are outside
this numerical qualification. Their parsing, fit/integration and quality-score
assumptions still require the Reservoir Engineer work in #681. A missing file
now fails instead of becoming an invented fixed-tier result. Human review of
source applicability, assumptions and business decisions remains required.
