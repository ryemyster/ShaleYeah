# Changelog — @shaleyeah/server-infrastructure

## [Unreleased]

### Added

- **Step A: Tier 1 server modularization** (#375) — Split monolithic `src/index.ts` (single `plan_infrastructure` tool) into four focused domain modules under `src/tools/`:
  - `pipeline.ts` — gathering/transmission routing, `derivePipelinePlan()`, `synthesizePipelinePlanWithLLM()`
  - `facilities.ts` — battery/separator/compressor/SWD sizing, `deriveFacilitySizing()`, `synthesizeFacilitySizingWithLLM()`
  - `cost-estimation.ts` — CAPEX with contingency, `deriveInfrastructureCostEstimate()`, `synthesizeCostEstimateWithLLM()`
  - `compliance.ts` — permits and approval timeline, `deriveComplianceAssessment()`, `synthesizeComplianceAssessmentWithLLM()`
- **Four MCP tools** replace the single `plan_infrastructure`: `plan_pipeline`, `size_facilities`, `estimate_costs`, `assess_compliance`
- `tests/tools.test.ts` — 28 tests covering domain math (gathering miles, facility ratios, CAPEX benchmarks, compliance risk)

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/servers/infrastructure.ts`
