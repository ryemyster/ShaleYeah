# Changelog — @shaleyeah/server-development

## [Unreleased]

## [0.2.0] — 2026-06-10

### Added
- Split monolithic `src/index.ts` into 3 focused domain modules in `src/tools/` (#373)
  - `planning.ts` — `DevelopmentOutlook`, `deriveDefaultDevelopmentOutlook`, `synthesizeDevelopmentOutlookWithLLM`
  - `phases.ts` — `DevelopmentPhase`, `PhaseSchedule`, `deriveDevelopmentPhases`, `synthesizeDevelopmentPhasesWithLLM`
  - `monitoring.ts` — `DevelopmentProgress`, `deriveProgressReport`
- Added `estimate_project_timeline` as a 3rd MCP tool backed by `phases.ts`
- Created `tests/tools.test.ts` with 28 domain logic tests (no API key required)
- `src/index.ts` is now a thin facade — preserved all backward-compat exports for existing tests

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/servers/development.ts`
