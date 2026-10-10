# Development

Work from this package directory when changing the Investment Chair agent.

```bash
cd agents/investment-chair
uv sync
uv run pytest
```

The package is ADK/Python. TypeScript and pnpm remain valid for `servers/decision` and shared workspace packages.

## Files

| Path | Purpose |
|------|---------|
| `agents-cli-manifest.yaml` | agents-cli project metadata |
| `.agents-cli-spec.md` | role, architecture, safety, eval, and deletion spec |
| `app/agent.py` | ADK root agent, instructions, tool registration, HITL markers |
| `app/decision_mcp.py` | Python MCP wrappers for the Decision server |
| `tests/test_adk_project_shape.py` | package shape and cleanup checks |
| `tests/test_adk_mcp_execution_shape.py` | MCP wrapper contract checks |
| `tests/test_adk_eval_harness_shape.py` | eval dataset/config shape checks |
| `tests/eval/` | behavior eval dataset and metrics config |

## Change Rules

- Keep the agent and Decision MCP server independently runnable.
- Match wrapper argument names to `servers/decision/src/index.ts`.
- Add pytest coverage for deterministic code and contract mapping.
- Add eval coverage for agent behavior, tool use, edge cases, and HITL boundaries.
- Update README, docs, and changelog when behavior or commands change.
- Keep migration/deletion evidence in `.agents-cli-spec.md`, changelogs, tests, issue comments, and PR body.

## Common Commands

```bash
uv run pytest
agents-cli run "Create an advisory bid strategy for this valuation."
agents-cli eval generate
agents-cli eval grade
```
