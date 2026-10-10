# Changelog — Drilling Engineer ADK Agent

## [Unreleased]

### Added

- **Drilling Engineer ADK migration** (#532) — added package-local ADK/Python project shape with `agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`, and `app/drilling_mcp.py`.
- **Drilling MCP tool parity** (#532) — added ADK Python wrappers for `design_drilling_program`, `estimate_well_costs`, and `assess_drilling_risks`.
- **Architecture classification** (#532) — documented and tested Drilling Engineer as a Stand-alone Agent with Progressive Disclosure (Skills), not a hierarchical, graph-based, ambient, or capability-first agent for this slice.
- **HITL boundary coverage** (#532) — documented and tested deferral for final drilling programs, AFE approval, spud approval, field-execution authorization, and safety-critical approval.
- **ADK eval coverage** (#532) — added package-local eval dataset/config coverage for control, edge, capability-boundary, architecture-boundary, and tool-selection cases.
- **Python regression tests** (#532) — added pytest coverage for ADK project shape, Drilling MCP wrapper parity, eval harness shape, architecture classification, HITL boundary markers, and the absence of dangling npm/TypeScript agent surfaces.

### Changed

- **Agent runtime surface** (#532) — Drilling Engineer is now an ADK/Python agent package. New Drilling Engineer reasoning/runtime work belongs in `app/agent.py` and `app/drilling_mcp.py`.
- **Documentation** (#532) — updated README and docs to use ADK/Python commands for the agent while preserving TypeScript/pnpm only for the `servers/drilling` MCP backend.

### Removed

- **TypeScript agent adapter** (#532) — removed `package.json`, `tsconfig.json`, `biome.json`, `src/`, and TypeScript-only agent tests from `agents/drilling-engineer`.

## [0.1.0] — 2026-06-10

### Added

- Historical TypeScript Tier 2 implementation paired with `servers/drilling`. This package surface is retired by the #532 ADK migration; new Drilling Engineer agent work belongs in `app/`.
