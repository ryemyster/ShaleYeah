# Changelog — Research Analyst

## [Unreleased]
- #722: Use the installed modern MCP client with a private credential-file reference, bounded calls and validated structured results; remove copied session initialization/serialization and correct the `/mcp` endpoint. Role reasoning and later employee qualification remain separately owned.


### Added

- Converted the Research Analyst into a package-local ADK/Python agent for #535.
- Added Python MCP wrappers for `conduct_market_research` and `analyze_competition`.
- Added pytest coverage for ADK project shape, MCP wrapper parity, eval harness shape, and the no-dangling-npm agent boundary.
- Added ADK eval fixtures for control, edge, and human-review boundary cases.

### Changed

- Rewrote package docs around the current ADK app: what the agent does, how it works, how to run/test/deploy it, how source limits are handled, and where human review is required.

### Removed

- Removed the old TypeScript agent package surface: `package.json`, `tsconfig.json`, `biome.json`, `src/`, and TypeScript-only agent tests.
