# Changelog — Risk Analyst ADK Agent

## [Unreleased]

### Added

- **Risk Analyst ADK migration** (#527) — added package-local ADK/Python project shape with `agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`, and `app/risk_analysis_mcp.py`.
- **Risk Analysis MCP tool parity** (#527) — added ADK Python wrappers for `assess_investment_risk` and `monte_carlo_simulation`.
- **ADK eval coverage** (#527) — added package-local eval dataset/config coverage for control, edge, capability-boundary, and tool-selection cases.
- **Python regression tests** (#527) — added pytest coverage for ADK project shape, Risk Analysis MCP wrapper parity, eval harness shape, and the absence of dangling npm/TypeScript agent surfaces.

### Changed

- **Agent runtime surface** (#527) — Risk Analyst is now an ADK/Python agent package. New Risk Analyst reasoning/runtime work belongs in `app/agent.py` and `app/risk_analysis_mcp.py`.
- **Documentation** (#527) — updated README and docs to use ADK/Python commands for the agent while preserving TypeScript/pnpm only for the `servers/risk-analysis` MCP backend.

### Removed

- **TypeScript agent adapter** (#527) — removed `package.json`, `tsconfig.json`, `biome.json`, `src/`, and TypeScript-only agent tests from `agents/risk-analyst`.
