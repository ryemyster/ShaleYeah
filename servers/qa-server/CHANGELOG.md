# Changelog — @shaleyeah/server-qa

## [Unreleased]

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
