# Local Testing

Use local tests for deterministic package behavior and evals for agent behavior.

## Pytest

```bash
cd agents/investment-chair
uv sync
uv run pytest
```

Pytest checks:

- ADK manifest and root agent shape.
- The app name matches the `app/` directory for eval sessions.
- Python wrappers map to the Decision MCP contract.
- HITL and architecture markers are present.
- Eval dataset and config files exist with control, edge, and boundary cases.

## Decision Server Smoke Check

```bash
cd servers/decision
pnpm test
```

This verifies the independent TypeScript MCP backend. It is a separate package from the ADK agent.

## ADK Eval

```bash
cd agents/investment-chair
agents-cli eval generate
agents-cli eval grade
```

Eval coverage lives in `tests/eval/`. It is where prompt behavior, tool-use quality, final-response quality, and high-consequence HITL boundaries should be judged. Do not write pytest tests that assert on LLM wording.
