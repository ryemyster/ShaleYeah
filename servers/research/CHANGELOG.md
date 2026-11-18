# Changelog — @shaleyeah/server-research

## [Unreleased]

### Added
- Split monolithic `src/index.ts` into focused domain modules under `src/tools/`: `market-research.ts` and `competitive-analysis.ts` (#369)
- Re-export test helpers (`deriveDefaultResearchSummary`, `synthesizeResearchWithLLM`, `deriveDefaultCompetitorEntry`) from `src/index.ts` for backwards compatibility with existing tests

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/servers/research.ts`
