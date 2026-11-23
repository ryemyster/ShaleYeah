# Changelog — Title Analyst ADK Agent

## [Unreleased]

- #685: Bind exact examination/instrument/policy sources to cited ownership and
  exception packets. Reuse installed native models, private context, review
  supervision and qualification; freeze provisional Fraction/citation/scope and
  authority controls. Add generic/external/source/archive/wheel CI checks.
  Delete source-less guessing/shim exports, global wrappers/default models and
  obsolete shape-only eval paths. Private recording grants no title clearance
  or professional acceptance.

- #722: Use the installed modern MCP client with a private credential-file reference, bounded calls and validated structured results; remove copied session initialization/serialization and correct the `/mcp` endpoint. Role reasoning and later employee qualification remain separately owned.


### Added

- **Architecture audit backfill** — documented the Stand-alone Agent with Progressive Disclosure (Skills) architecture mode, non-selected architecture boundaries, HITL deferral expectations, and added eval/test coverage that prevents misclassification.
- **Title Analyst ADK migration** (#528) — added package-local ADK/Python project shape with `agents-cli-manifest.yaml`, `.agents-cli-spec.md`, `pyproject.toml`, `app/agent.py`, and `app/title_mcp.py`.
- **Title MCP tool parity** (#528) — added ADK Python wrappers for `examine_ownership`, `analyze_lease`, `check_burdens`, and `trace_chain_of_title`.
- **ADK eval coverage** (#528) — added package-local eval dataset/config coverage for control, edge, capability-boundary, and tool-selection cases.
- **Python regression tests** (#528) — added pytest coverage for ADK project shape, Title MCP wrapper parity, eval harness shape, and the absence of dangling npm/TypeScript agent surfaces.

### Changed

- **Agent runtime surface** (#528) — Title Analyst is now an ADK/Python agent package. New Title Analyst reasoning/runtime work belongs in `app/agent.py` and `app/title_mcp.py`.
- **Documentation** (#528) — updated README and docs to use ADK/Python commands for the agent while preserving TypeScript/pnpm only for the `servers/title` MCP backend.

### Removed

- **TypeScript agent adapter** (#528) — removed `package.json`, `tsconfig.json`, `biome.json`, `src/`, and TypeScript-only agent tests from `agents/title-analyst`.
