# Local testing

Install the paired employee dependencies with `uv sync --locked` in
`agents/reservoir-engineer`, then build this package and run `pnpm test`.
The suite covers numerical kernels, current source binding, input/unit/time/grain
failures, observed diagnostics, normalized snapshot hooks, independent stdio,
protected HTTP, actual native output grading, separate human review and
restart/replay/revocation. Provider responses are offline fixtures; no paid keys
are needed. Expected denial cases emit safe failed-tool events.

Run `node scripts/check-extraction.mjs --bundle /absolute/new/empty-bundle --report /absolute/report.json`
for independent source, wheel and production archives. Run
`python3 scripts/check-containers.py --bundle /absolute/bundle --report /absolute/container-report.json`
for the separate non-root images. Inspect exact receipts and limitations. A
missing runtime, archive or selected qualification is a failure, not a skipped
success. Build and package tests alone do not establish container support.
