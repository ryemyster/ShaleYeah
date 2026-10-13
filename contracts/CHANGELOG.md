# Changelog

## [Unreleased]

- #542: publish explicitly selected JSON-source artifact profile 0.2.0 and generated/validated Python/TypeScript bindings. Preserve closed LAS/CSV source and employee 0.1.0 values; unknown versions and automatic format downgrade fail.


- #574: contracts package 0.3.0 adds separate event profile 0.1.0, Python/TypeScript validation/redaction, generated types, shared adversarial fixtures and isolated archive exports. Existing employee/source profiles remain unchanged.


- #670: added separate connector profile 0.1.0, explicit Python/TypeScript source/private-configuration validators, offline shared-schema resolution, generated bindings and isolated npm/wheel controls. Existing employee schema 0.1.0 remains unchanged. Public package API advances to 0.2.0; structural validation does not authorize reads.

- Added ADR 0004 for #572: mandatory/conditional employee/tool compositions,
  pinned MCP 2025-11-25 profile, deferred A2A, discovery/schema/state mapping,
  context/review/credential boundaries, cancellation/deadline requirements and
  adapter upgrade/deletion owners. Added 34 shared validator cases and a bound
  external employee control; 28 adapter scenarios and an MCP transcript remain
  future acceptance targets. No production schema, dependency or runtime change.

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
