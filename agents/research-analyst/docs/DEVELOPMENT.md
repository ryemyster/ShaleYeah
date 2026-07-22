# Development

Work inside `agents/research-analyst` for agent changes. Work inside `servers/research` for MCP tool implementation changes.

## Setup

```bash
cd agents/research-analyst
uv run pytest
```

`uv` reads `pyproject.toml`, creates the local Python environment, and runs the package-local tests.

## Package Boundary

This agent is ADK/Python. Use `uv` and the package-local `pyproject.toml` for agent development. TypeScript work for the Research MCP tools belongs in `servers/research`.

Allowed in this package:

- `app/agent.py`
- `app/research_mcp.py`
- `pyproject.toml`
- `agents-cli-manifest.yaml`
- pytest tests
- ADK eval fixtures
- package docs

Keep backend files in `servers/research`, not in the agent package:

- MCP tool schemas
- source fetcher implementations
- deterministic fallback implementations
- TypeScript build and lint configuration

## Change Workflow

1. Add or update pytest/eval coverage for the behavior first.
2. Update `app/agent.py` for instructions, architecture boundary, or tool exposure.
3. Update `app/research_mcp.py` when the MCP contract changes.
4. Update docs when setup, use, deployment, source handling, or human-review behavior changes.
5. Run package-local tests before committing.

Use #536 as the role and boundary reference.
