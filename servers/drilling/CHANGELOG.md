# Changelog — @shaleyeah/server-drilling

## [Unreleased]

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
