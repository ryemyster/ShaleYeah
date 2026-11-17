# Testing Market locally

From this package:

```sh
pnpm build
pnpm type-check
pnpm lint
pnpm test
```

Tests are offline and require no real EIA, model or MCP credential. Synthetic rows deliberately preserve dates, source IDs, units, zero and negative commodity prices. Company records and review identities are fictional fixture data, not current commercial facts.

The suite covers source-backed controls, absent/failed access, partial HTTP success, malformed/ambiguous/wrong-series or wrong-unit rows, stale/future observations, cache expiry and credential changes. Concurrent requests cannot repopulate a cleared cache or overwrite a newer credential's data. It also exercises the actual private operator file, explicit assumptions, denied/changed rights, unknown-company evidence, malformed/failed model output and public MCP handlers. Advisory exports must be new private files and cannot follow links or overwrite sources; the test inspects the same open file handle after denied overwrite/link attempts.

A real-key smoke test is a separate operator action: configure the host credentials and source rights, query through a generic client, and inspect the returned series, actual observation date, unit and status. The offline pass does not prove live-feed availability or professional commercial quality.

For HTTP, use an explicitly configured private identity/scope and audit binding from the [SDK access guide](../../../sdk/docs/http-access.md). A refused connection or missing access policy is not market evidence. Setting `PORT` alone does not create that binding.

## Employee and independent-package checks

`pnpm test` also covers source-bound scenarios, current rights, private review,
separate human CLI, installed Python qualification and the native ADK/HTTP journey
under both scripted providers. Set `MARKET_TEST_PYTHON` when using an independently
installed employee environment; the default is the authoring package's venv.
Native traces may be retained under `MARKET_TEST_TRACE_DIRECTORY` for key-free
Google local-handler grading. No selected native test is optional in CI.

From the repository root, use a new empty bundle directory and report path:

```sh
node servers/market/scripts/check-extraction.mjs --bundle /private/tmp/NEW-market-bundle --report /private/tmp/NEW-market-extraction.json
python3 servers/market/scripts/check-containers.py --bundle /private/tmp/NEW-market-bundle --report /private/tmp/NEW-market-containers.json
```

Extraction installs declared npm archives and Python wheels outside the checkout,
builds the server from its own source, runs employee/external/native/review checks
and verifies the production-only generic client. Container checks require a working
Linux Docker runtime and repeat the two installed images' qualified human review,
restart/replay and revocation journey. Reports remain blocked when prerequisites
or controls fail; a denial-control pass is not container qualification.
