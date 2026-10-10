# Changelog — Development Planner

## [Unreleased]

### Added

- Converted the Development Planner into a package-local ADK/Python agent for #534.
- Added Python MCP wrappers for `create_development_plan`, `estimate_project_timeline`, and `monitor_development_progress`.
- Added pytest coverage for ADK project shape, MCP wrapper parity, eval harness shape, and the no-dangling-npm agent boundary.
- Added ADK eval fixtures for control, edge, and human-review boundary cases.

### Changed

- Rewrote package docs around the current ADK app: what the agent does, how it works, how to run/test/deploy it, and where human review is required.

### Removed

- Removed the old TypeScript agent package surface: `package.json`, `tsconfig.json`, `biome.json`, `src/`, and TypeScript-only agent tests.
