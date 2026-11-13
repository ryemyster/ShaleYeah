# Testing Market locally

From this package:

```sh
pnpm build
pnpm type-check
pnpm lint
pnpm test
```

Tests are offline and require no real EIA, model or MCP credential. Synthetic rows deliberately preserve dates, source IDs, units, zero and negative commodity prices. Company records and review identities are fictional fixture data, not current commercial facts.

The suite covers source-backed controls, absent/failed access, partial HTTP success, malformed/ambiguous/wrong-series or wrong-unit rows, stale/future observations, cache expiry and credential changes. It also exercises the actual private operator file, explicit assumptions, denied/changed rights, unknown-company evidence, malformed/failed model output and public MCP handlers. Advisory exports must be new private files and cannot follow links or overwrite sources.

A real-key smoke test is a separate operator action: configure the host credentials and source rights, query through a generic client, and inspect the returned series, actual observation date, unit and status. The offline pass does not prove live-feed availability or professional commercial quality.

For HTTP, use an explicitly configured private identity/scope and audit binding from the [SDK access guide](../../../sdk/docs/http-access.md). A refused connection or missing access policy is not market evidence. Setting `PORT` alone does not create that binding.
