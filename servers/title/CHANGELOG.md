# Changelog — @shaleyeah/server-title

## [Unreleased]

- #685: Bind exact examination/instrument/policy sources to cited ownership and
  exception packets. Reuse installed native models, private context, review
  supervision and qualification; freeze provisional Fraction/citation/scope and
  authority controls. Add generic/external/source/archive/wheel CI checks.
  Exercise actual stdio reads and drafting after removing development dependencies;
  a plain JavaScript client also checks source revocation.
  Keep the native fixture within its fixed context allocation through progressive
  source disclosure; preserve direct view-tool tests and exact review gates.
  Delete source-less guessing/shim exports, global wrappers/default models and
  obsolete shape-only eval paths. Private recording grants no title clearance
  or professional acceptance.


### Added

- **Step A: Tier 1 server modularization** (#372) — Split monolithic `src/index.ts` (single `examine_title` tool) into four focused domain modules under `src/tools/`:
  - `ownership.ts` — WI/NRI calculations, `calculateNRI()`, `deriveOwnershipBreakdown()`, `synthesizeOwnershipWithLLM()`
  - `lease-analysis.ts` — lease term parsing, `parseLeaseTermMonths()`, `deriveLeaseAnalysis()`, `synthesizeLeaseAnalysisWithLLM()`
  - `burden-check.ts` — ORRI/encumbrance identification, `calculateTotalBurden()`, `deriveBurdenAssessment()`, `synthesizeBurdenCheckWithLLM()`
  - `chain-of-title.ts` — conveyance chain validation, `assessChainRisk()`, `deriveChainOfTitle()`, `synthesizeChainOfTitleWithLLM()`
- **Four MCP tools** replace the single `examine_title`: `examine_ownership`, `analyze_lease`, `check_burdens`, `trace_chain_of_title`
- `tests/tools.test.ts` — 22 tests covering domain math and parsing (NRI formula, lease term parsing, burden totals, chain risk scoring)

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/servers/title.ts`
