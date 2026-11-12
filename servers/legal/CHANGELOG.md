# Changelog — @shaleyeah/server-legal

## [Unreleased]

- #683: replace source-less default analysis with ten current source/provision/citation,
  memo and review tools. Validate exact JSON exports, UTF-8 quote identity, provision-level
  scope/date eligibility, required questions/revisions and retained conflicts. Bind
  current file bytes/rights, private audit/redaction, installed qualification and separate
  enrolled human review before private recording. Add generic MCP and independent
  source/archive/container controls; delete default risk/cost/timeline and keyword
  derivations, silent LLM fallbacks and old tests. No model key, legal clearance,
  signature, filing, waiver, settlement or capital authority is supplied by this backend.

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
