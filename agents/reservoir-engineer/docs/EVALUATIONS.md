# Reservoir Engineer evaluations

The JSON [profile](../tests/eval/performance_profile.json) configures ten required
metrics over a hash-bound [21-case dataset](../tests/eval/datasets/reservoir-performance.json).
Cases, registered tolerances, freshness limits and expected tools are editable
configuration. Installed policy keeps contract, provenance, assumptions,
authority, architecture, persistence, tool, source-fidelity and numerical checks
mandatory. A model judge cannot waive those gates or authorize a save.

Codex authored the initial labels under the maintainer's research authorization.
Eight synthetic references declare known initial rates, nominal decline and b,
independently of fitted outputs. They cover harmonic, exponential, hyperbolic,
monthly gas conversion, insufficient history, cutoff, initially below-cutoff and
missing holdout cases. The installed grader uses a separate Python rate equation,
cutoff bisection and Simpson quadrature. It verifies fit parameters, observed
counts, RMSE/R-squared, cohort/future volumes, units, conventions, work findings
and the absence of reserves authority. Exact actual output must also match trusted
current backend observations.

The mathematical reference is [Equinor's technical report](https://equinor.github.io/decline-curve-analysis/dca_report.html),
reviewed November 6, 2026. [EIA's 2020 method](https://www.eia.gov/analysis/drilling/curve_analysis/2020/)
informs the distinction between observations, normalization and extrapolated
quantities; these controls do not implement EIA's monthly-total routine.
The oracle and observed fixture snapshot have separate byte hashes bound into
the dataset. Updating either requires explicit reviewed label/configuration
revisions; retain previous results for comparison.

Counterexamples include stale/missing/foreign sources, changed assumptions,
wrong units/counts, invented volume, R-squared, uncertainty or reserves, missing
tools, delegation and unapproved persistence. Fixture qualification recomputes
reports against frozen standards and an explicit baseline. It is separate from
actual native trace generation and Google local-handler grading.

Run `uv run --locked python tests/eval/run_fixture_evals.py --output PATH --code-revision SHA`
for the frozen benchmark. The protected pair test generates actual native traces;
`export_cli_traces.py`, `grade_local_google.py` and `verify_cli_grade.py` grade those
traces with the pinned CLI-compatible local handler. Installed qualification
binds an inspected review packet before human approval. Synthetic controls do not
measure live model skill, field accuracy, professional reserves judgment, operator
effort or final MVP acceptance.
