# Development

Work inside `agents/development-planner` for agent changes. Work inside `servers/development` for MCP tool implementation changes.

## Setup

```bash
cd agents/development-planner
uv run pytest
```

`uv` reads `pyproject.toml`, creates the local Python environment, and runs the package-local tests.

## Package Boundary

This agent is ADK/Python. Use `uv` and the package-local `pyproject.toml` for agent development. TypeScript work for the Development MCP tools belongs in `servers/development`.

Allowed in this package:

- `app/agent.py`
- `app/development_mcp.py`
- `pyproject.toml`
- `agents-cli-manifest.yaml`
- pytest tests
- ADK eval fixtures
- package docs

Keep these backend files in `servers/development`, not in the agent package:

- `package.json`
- `tsconfig.json`
- `biome.json`
- `src/agent/`
- `dist/agent/`
- TypeScript-only agent tests

The TypeScript MCP backend remains valid in `servers/development`.

## Change Workflow

1. Add or update pytest/eval coverage for the behavior first.
2. Update `app/agent.py` for instructions, architecture boundary, or tool exposure.
3. Update `app/development_mcp.py` when the MCP contract changes.
4. Update docs when setup, use, deployment, or human-review behavior changes.
5. Run package-local tests before committing.

Use `docs/development-planner-role.md` as the role and boundary reference.
