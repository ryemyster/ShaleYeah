# Changelog — @shaleyeah/server-legal

## [Unreleased]

## [0.2.0] — 2026-06-10

### Added
- Split `src/index.ts` into focused domain modules: `src/tools/regulatory.ts`, `src/tools/contract.ts`, `src/tools/compliance.ts` (#370)
- Added third MCP tool: `assess_compliance` backed by `compliance.ts`
- `servers/legal/tests/tools.test.ts` — 32 unit tests for domain logic (no API key required)
- Backward-compat exports preserved so existing tests continue to pass

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/servers/legal.ts`
