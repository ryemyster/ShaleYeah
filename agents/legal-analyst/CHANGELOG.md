# Changelog - Legal Analyst ADK Agent

## [Unreleased]

### Added

- **Legal Analyst ADK migration** (#531) — added package-local ADK/Python project shape with `agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`, and `app/legal_mcp.py`.
- **Legal MCP tool parity** (#531) — added ADK Python wrappers for `analyze_legal_framework`, `review_contract`, and `assess_compliance`.
- **Architecture classification** (#531) — documented and tested Legal Analyst as a Stand-alone Agent with Progressive Disclosure (Skills), not a hierarchical, graph-based, ambient, or capability-first agent for this slice.
- **HITL boundary coverage** (#531) — documented and tested deferral for legal opinions, contract redlines, filings, signatures, waivers, settlement positions, and binding approvals.
- **ADK eval coverage** (#531) — added package-local eval dataset/config coverage for control, edge, capability-boundary, architecture-boundary, HITL-deferral, and tool-selection cases.
- **Python regression tests** (#531) — added pytest coverage for ADK project shape, Legal MCP wrapper parity, eval harness shape, architecture classification, HITL boundary markers, and the absence of dangling npm/TypeScript agent surfaces.

### Changed

- **Agent runtime surface** (#531) — Legal Analyst is now an ADK/Python agent package. New Legal Analyst reasoning/runtime work belongs in `app/agent.py` and `app/legal_mcp.py`.
- **Documentation** (#531) — updated README and docs to use ADK/Python commands for the agent while preserving TypeScript/pnpm only for the `servers/legal` MCP backend.

### Removed

- **TypeScript agent adapter** (#531) — removed `package.json`, `tsconfig.json`, `biome.json`, `src/`, and TypeScript-only agent tests from `agents/legal-analyst`.
