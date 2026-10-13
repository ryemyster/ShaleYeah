# Changelog — @shaleyeah/server-qa

## [Unreleased]

- #722: keep the independently executed MCP fixture client in exported production dependencies and verify its import after development packages are removed, before separate container qualification.

- #722: pin the shared MCP 2026-07-28 profile and maintained client dependencies; preserve existing role/source/review behavior and migrate direct protocol fixtures and standalone checks.

### Changed

- #716: deterministic completeness, correctness, units, identity, duplication,
  freshness, provenance and contradiction checks on declared normalized and
  canonical-work profiles; located defects, partial/untested/error states,
  measured denominators and bounded detail.
- Recheck current task, approved profile hash, source byte/revision/projection,
  recipient read/export rights and secret policy; immutable scoped private
  SQLite artifacts retain original expiry and survive restart.
- Reports consume exact recorded results. Optional configured native-model
  triage stays unreviewed and cannot waive, repair, approve or change a verdict.
- The independent build invokes its declared local compiler directly, preserving
  npm-installed archives rather than triggering a pnpm reinstall. A compiler
  regression covers execution with no package manager available.
- Package-owned build/settings, declared dependencies, synthetic 22-case
  scorecards, actual generic HTTP/stdio controls, independent source/archive
  verification and installed non-root Node container CI.

### Removed

- Threshold-only PASS fallback, target-count coverage estimates, verdict-derived
  100% passRate, fixed confidence, fuzzy identity, arbitrary output paths and
  unobserved report assessment claims.
- Displaced validation/reporting helpers and tests rewarding fabricated success.
  QA TypeScript employee migration and its private wrapper remain owned by #542.

## [0.2.0] — 2026-06-10

### Added
- Split monolithic `src/index.ts` into 2 focused domain modules in `src/tools/` (#411)
  - `validation.ts` — `QAValidationResult`, `deriveDefaultQAResult`, `synthesizeQAValidationWithLLM`
  - `reporting.ts` — `QAReport`, `deriveQualityReport` (extracted from `generate_quality_report` handler)
- Created `tests/tools.test.ts` with 23 domain logic tests (no API key required)
- `src/index.ts` is now a thin facade — preserved all backward-compat exports for existing tests
- Clarified doc intent: QA server validates O&G analysis outputs (peer review of deal analysis), not runtime software monitoring

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/servers/qa-server.ts`
