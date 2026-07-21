# Changelog — Market Analyst ADK Agent

## [Unreleased]

### Added

- **Market Analyst ADK migration** (#530) — added package-local ADK/Python project shape with `agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`, and `app/market_mcp.py`.
- **Market MCP tool parity** (#530) — added ADK Python wrappers for `analyze_market_conditions` and `competitive_analysis`.
- **ADK eval coverage** (#530) — added package-local eval dataset/config coverage for control, edge, capability-boundary, and tool-selection cases.
- **Python regression tests** (#530) — added pytest coverage for ADK project shape, Market MCP wrapper parity, eval harness shape, and the absence of dangling npm/TypeScript agent surfaces.

### Changed

- **Agent runtime surface** (#530) — Market Analyst is now an ADK/Python agent package. New Market Analyst reasoning/runtime work belongs in `app/agent.py` and `app/market_mcp.py`.
- **Documentation** (#530) — updated README and docs to use ADK/Python commands for the agent while preserving TypeScript/pnpm only for the `servers/market` MCP backend.

### Removed

- **TypeScript agent adapter** (#530) — removed `package.json`, `tsconfig.json`, `biome.json`, `src/`, and TypeScript-only agent tests from `agents/market-analyst`.
