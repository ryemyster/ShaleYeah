# Changelog — Geologist ADK Agent

## [Unreleased]

### Added

- **Geologist ADK tool parity** (#597) — added package-local Python MCP execution for every current Geowiz tool: `analyze_formation`, `assess_quality`, `process_well_logs`, `process_gis`, `process_access_database`, `process_document`, `process_seismic_data`, `process_aries_database`, and `save_finding`.
- **ADK eval coverage** (#596/#597) — added package-local eval dataset/config coverage for control, edge, capability-boundary, and tool-selection cases.
- **ADK project shape** (#587/#589) — added `agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`, and `app/geowiz_mcp.py` under `agents/geologist`.
- **Python regression tests** (#597) — added pytest coverage for ADK project shape, Geowiz MCP wrapper parity, eval harness shape, and the absence of dangling npm/TypeScript agent surfaces.

### Changed

- **Agent runtime surface** (#597) — Geologist is now an ADK/Python agent package. New Geologist reasoning/runtime work belongs in `app/agent.py` and `app/geowiz_mcp.py`.
- **Documentation** (#597) — updated README and docs to use ADK/Python commands for the agent while preserving TypeScript/pnpm only for the `servers/geowiz` MCP backend.

### Removed

- **TypeScript agent adapter** (#597) — removed `package.json`, `tsconfig.json`, `biome.json`, `src/agent/`, and TypeScript-only agent tests from `agents/geologist`.

## [0.1.0] — 2026-06-04

### Added

- Initial package extraction from monorepo conversion (#385).
- Standalone Geologist agent package boundary before the ADK migration.
