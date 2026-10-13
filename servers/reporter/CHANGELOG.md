# Changelog — @shaleyeah/server-reporter

## [Unreleased]

- #722: pin the shared MCP 2026-07-28 profile and maintained client dependencies; preserve existing role/source/review behavior and migrate direct protocol fixtures and standalone checks.

### Changed

- #541: assemble reports from current authenticated reviewed work, preserve literal values/units/unknowns and reject conflicting or stale authority. Add private operator configuration, exact qualified human review and bounded release/replay. Delete fabricated confidence, recommendations, default synthesis and arbitrary caller paths.

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/servers/reporter.ts`
