# Changelog — Geologist ADK Agent

## [Unreleased]

- #674: standalone source/wheel export includes the reviewed profile, dataset, qualification policy and frozen baseline; separate portable Python container recipe and isolated native-provider/context/review journey. Format generated context timestamps to millisecond precision under the existing contract; reproduced microsecond-clock failure and added coverage. No persona, mode, wire schema or host authority change.

- #577: adopted evaluation 0.3.0 and frozen reference baseline/policy; existing fixture runner now produces code-bound qualification decisions and blocks missing or changed inputs. Required CI/release reference checks preserve standalone Skills, role tools, private context and authenticated human authority. Initial research-reviewed targets need no outside reviewer to start; fixture conformance does not claim live/domain or final human acceptance.

- #673: add prepare/status tools and a deterministic ReviewSupervisor for one exact Geowiz-reviewed save after restart. Replace inline finding save arguments with backend packet/grant references; preserve native ADK confirmation as additional UI only. Native pinned SQLite pause/resume and rejected/changed/missing-grant controls supplement backend MCP/CLI authorization. Primary standalone mode, model profiles and canonical schemas remain.

- #672: added scoped durable SQLite context and native ADK session/runner bindings, current source/review and transitive dependency checks, metadata revisions separate from source-byte identity, retained pending/conflicting work, actual invocation byte/provider-token gates and sealed dispatch. Added original-expiry export/restore, durable deletion markers, native history purge, writer/ownership guards and isolated-wheel controls. Default CLI remains the development entrypoint; authenticated protected review/continuation stays #673. Blocked context emits blocked employee status instead of model/agent success.

- #671: forward explicitly supplied density assumptions and reviewer confidence with basis, preserving zero and rejecting invalid scenarios before transport. Correct the shared synthetic LAS fixture's stop/column comment, source hash/byte count and performance dataset reference. Native provider/source/event/confirmation controls remain independent of professional qualification; research-based initial review is documented with Geowiz.

- #574: work-event hooks preserve absent optional confidence and zero values, and distinguish a failed work product from a blocked one. Canonical edge fixtures fail before the repair and pass afterward.

- #574: adopted installed client 0.2.0/evaluations 0.2.1, native ADK event callbacks and host task/context/work/eval/review hooks. Added private event settings, actual protected two-provider trace and attestation-binding controls. Existing confirmation/budget/standalone topology remains; context/reviewer authorization/resume stay with #672/#673. Removed stale moving-model env guidance.


- #667: added portable frozen-run reports, hard-failure/infrastructure states, versioned runtime-observed architecture and source-bound numeric gates, candidate comparison and the pinned Geologist ADK/agents-cli adapter with an independent BYO qualitative judge. Source-linked LAS/policy fixtures and installed SDK controls require no paid key; professional acceptance, durable review and promotion remain separate.

- #666: replaced executable eval YAML and test exec with a versioned JSON profile and installed trusted registry; preserve all role expectations and observed confirmation. Explicit evaluation dependency and wheel isolation; runner adaptation remains #667.

- #670: actual native Gemini/Anthropic ADK-to-Geowiz fixtures now require explicit source grants, verify canonical byte-hash provenance and preserve role mappings/save confirmation. This qualifies source-boundary plumbing, not geological interpretation.

### Changed
- #669: explicit Gemini/Anthropic profiles across Geologist reasoning and Geowiz formation synthesis, private credentials, capability/limit checks, provider receipts and independent judge configuration. Remove reference vendor defaults and fabricated synthesis fallback; offline native ADK/MCP conformance preserves role tools and save confirmation.

### Added

- **Architecture audit backfill** — documented the Stand-alone Agent with Progressive Disclosure (Skills) architecture mode, non-selected architecture boundaries, HITL deferral expectations, and added eval/test coverage that prevents misclassification.
- **Geologist ADK tool parity** (#597) — added package-local Python MCP execution for every current Geowiz tool: `analyze_formation`, `assess_quality`, `process_well_logs`, `process_gis`, `process_access_database`, `process_document`, `process_seismic_data`, `process_aries_database`, and `save_finding`.
- **ADK eval coverage** (#596/#597) — added package-local eval dataset/config coverage for control, edge, capability-boundary, and tool-selection cases.
- **ADK project shape** (#587/#589) — added `agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`, and `app/geowiz_mcp.py` under `agents/geologist`.
- **Python regression tests** (#597) — added pytest coverage for ADK project shape, Geowiz MCP wrapper parity, eval harness shape, and the absence of dangling npm/TypeScript agent surfaces.

### Changed

- **Installed MCP client** (#679) — declared `shaleyeah-mcp-client==0.1.0`, replaced private session/discovery/schema/result logic with a thin role adapter, added dedicated private credential references and validated `/mcp` destinations/limits. Kept nine mappings, model/instructions and ADK confirmation. Moved protocol tests into the helper; role/failure, credential and isolated-wheel controls plus actual protected Geowiz interoperability pass. Backend source/review/professional qualification remains separate.

- **MCP schema and result boundary** (#677) — added bounded discovery/input/output validation, retained structured-only evidence and native errors, rejected conflicting representations and incompatible role capabilities, and recognized legacy success-masked failures. Declared JSON Schema as a direct dependency; added real behavioral fake-session controls. Existing ADK confirmation/role deferral remains; live domain, shared-client and access qualification remain separate.

- **Contributor commands** (#498) — frozen setup and shape checks, fixture paths, explicit eval dataset/config and artifact/prerequisite guidance, tests-first tool workflow and optional lint extra. Removed inline fake-key config and generic eval defaults; no runtime or metric behavior changed.

- **Deployment documentation** (#578) — linked ordered reference setup and the support matrix, separated provider credentials and actual CLI ports, and documented in-memory session, backend authority and durable context/review qualification limits. No employee runtime change.

- **Agent runtime surface** (#597) — Geologist is now an ADK/Python agent package. New Geologist reasoning/runtime work belongs in `app/agent.py` and `app/geowiz_mcp.py`.
- **Documentation** (#597) — updated README and docs to use ADK/Python commands for the agent while preserving TypeScript/pnpm only for the `servers/geowiz` MCP backend.

### Removed

- **TypeScript agent adapter** (#597) — removed `package.json`, `tsconfig.json`, `biome.json`, `src/agent/`, and TypeScript-only agent tests from `agents/geologist`.

## [0.1.0] — 2026-06-04

### Added

- Initial package extraction from monorepo conversion (#385).
- Standalone Geologist agent package boundary before the ADK migration.
