# Changelog

## [Unreleased]

- Added ADR 0003 for #573: trusted principal/policy provenance, explicit local and
  remote modes, protected operations, exact-revision review, replay/idempotency,
  audit failure/reconciliation, credentials and source/workspace/egress limits.
  Added 32 shared executable validator cases and 28 future runtime acceptance
  scenarios; both languages verify the review/input/operation reference chain.
  Existing 0.1.0 schema and runtime enforcement boundaries remain unchanged.

- Added ADR 0002 and synthetic context lifecycle cases for #571, covering private
  ownership, reviewed handoffs, deterministic retrieval/budgets, source-preserving
  compaction, invalidation and export/deletion; both languages verify record shapes
  and review/source bindings. Runtime enforcement remains #672/#673/#573.

- Added canonical 0.1.0 employee charter, task, work-product, context and review
  schemas with generated TypeScript declarations and Python/TypeScript validation.
- Added shared fixtures, scope/revision/policy comparisons, coverage gates,
  declaration drift checks and isolated distribution verification for #568.
