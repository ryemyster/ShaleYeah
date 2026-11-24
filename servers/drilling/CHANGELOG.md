# Changelog — @shaleyeah/server-drilling

## [Unreleased]

- #686: replace unsupported fixed program/cost/risk guesses and global LLM fallback exports with exact operator-file design/evidence/constraint inputs, unit/datums, quoted-cost/schedule arithmetic and hazard/offset coverage. Add original UTF-8 citations, current source rights, enrolled exact engineer review and installed qualification before idempotent private recording. Build a clean compiled entry and independent source/production archive controls; no operational authority.

## [0.2.0] — 2026-06-10

### Added
- Split monolithic `index.ts` into 3 focused domain modules: `src/tools/program.ts`, `src/tools/costs.ts`, `src/tools/risks.ts` (#374)
- Added `estimate_well_costs` MCP tool — drilling/completion/facilities cost breakdown by well type and depth
- Added `assess_drilling_risks` MCP tool — geological, operational, and environmental risk scoring with mitigations
- Added `tests/tools.test.ts` with 30 unit tests covering domain logic (no API key required)
- Backward-compat shims: `deriveDefaultDrillingInterpretation` and `synthesizeDrillingAnalysisWithLLM` preserved

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/servers/drilling.ts`
