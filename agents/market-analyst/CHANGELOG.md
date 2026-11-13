# Changelog — Market Analyst ADK Agent

## [Unreleased]
- #684: Adopt shared configured native runtime, current source/private context,
  declarative twelve-gate scorecard, actual final-output grading and the common
  review supervisor. Bind exact work/scenarios to installed qualification and a
  separate human decision before private recording. Preserve advisory tools;
  replace global wrappers, old inline eval YAML/data and shape-only tests with
  functional contracts, frozen cases and native/independent-package controls.
  Add extraction/container artifacts and required role CI. Initial labels and
  prices remain provisional fictional fixtures, without professional acceptance.

- #708: Document the repaired backend's unavailable/source/assumption fields and
  host configuration; correct the protected HTTP setup instructions and remove
  the stale fixed-price fallback example from the project spec. Agent code,
  reasoning and full employee qualification remain owned by #684.

- #722: Use the installed modern MCP client with a private credential-file reference, bounded calls and validated structured results; remove copied session initialization/serialization and correct the `/mcp` endpoint. Role reasoning and later employee qualification remain separately owned.


### Added

- **Architecture audit backfill** — documented the Stand-alone Agent with Progressive Disclosure (Skills) architecture mode, non-selected architecture boundaries, HITL deferral expectations, and added eval/test coverage that prevents misclassification.
- **Market Analyst ADK migration** (#530) — added package-local ADK/Python project shape with `agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`, and `app/market_mcp.py`.
- **Market MCP tool parity** (#530) — added ADK Python wrappers for `analyze_market_conditions` and `competitive_analysis`.
- **ADK eval coverage** (#530) — added package-local eval dataset/config coverage for control, edge, capability-boundary, and tool-selection cases.
- **Python regression tests** (#530) — added pytest coverage for ADK project shape, Market MCP wrapper parity, eval harness shape, and the absence of dangling npm/TypeScript agent surfaces.

### Changed

- **Agent runtime surface** (#530) — Market Analyst is now an ADK/Python agent package. New Market Analyst reasoning/runtime work belongs in `app/agent.py` and `app/market_mcp.py`.
- **Documentation** (#530) — updated README and docs to use ADK/Python commands for the agent while preserving TypeScript/pnpm only for the `servers/market` MCP backend.

### Removed

- **TypeScript agent adapter** (#530) — removed `package.json`, `tsconfig.json`, `biome.json`, `src/`, and TypeScript-only agent tests from `agents/market-analyst`.
