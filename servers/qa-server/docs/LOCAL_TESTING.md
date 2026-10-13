# Local testing

Build first, then run the package-local commands listed in the README. The test
suite uses synthetic data and no live provider key. It exercises eight rule
controls and defects; zero rules/observations; missing references; malformed
schemas; exact hashes/IDs/units/bases; partial failures; bounded defect details;
private storage/restart/expiry; task/profile/source revocation; model outage;
HTTP identity/correlation; and a real configured stdio client.

`pnpm test:coverage` requires at least 90% line coverage of package source.
`pnpm qualify --report <file>` executes the 22 versioned cases in
`examples/qualification-cases.json` and writes a metadata scorecard. Detection
precision/recall use 16 labeled control/defect cases. Source coverage is separate;
reviewer effort remains null until observed. These initial research-assisted
labels do not measure field or professional accuracy.

`pnpm test:extraction` copies only this package and declared archives to a
separate temporary directory, runs its clean build/coverage suite, then repeats
behavior checks against installed production code. Temporary files are removed.
A failure blocks the extraction report. Container tests run on a Docker-capable
host from that same extracted production lock; they are required in CI.

If access is denied, inspect current principal/scopes, task/profile references,
approved profile hash and source grants. If a result is untested, inspect its
missing source/reference or unsupported basis. If configuration is unavailable,
check file ownership/permissions and supported versions. Never replace an error
with a success template or change permissions to make a failing fixture pass.
