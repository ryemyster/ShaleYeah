# Changelog

## [Unreleased]

- #671: classify verified bytes with invalid declared format as permanent conflicting evidence rather than a retryable source outage. Provenance, current-grant rechecks, private snapshots, source rights and audit behavior are unchanged.

- #574: isolated archive installation now consumes contracts 0.3.0. Connector/source profile and runtime behavior are unchanged; the new event profile stays separate.

- #670: added extractable read-only connector runtime, reviewed installed-adapter
  selection, scoped current grants, private credentials, fail-closed audit,
  bounded LAS/CSV file transport, exact-hash artifacts, real health checks and
  temporary parser snapshots. File and fake internal API conformance plus
  isolated installation require no model or warehouse. No live vendor or
  professional-domain qualification is claimed.
