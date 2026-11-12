# Testing Legal Analyst locally

From this directory:

```sh
uv sync --locked
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
agents-cli info
```

Native Gemini and Anthropic tests use offline HTTP provider fixtures; they require no real key. They test configured adapters, tool schemas, returned-output grading, private context restoration and revoked authority. They do not measure live-model legal quality.

The [frozen runner](EVALUATIONS.md) verifies research-backed provisional control/edge/authority decisions and exact reference hashes. Changing a profile/dataset creates a new configuration identity; a prior result cannot qualify different bytes.

For a live task, run an explicitly authorized backend and configure model/MCP credential references as described in [integration](INTEGRATION.md). A refused connection, denied credential or stale/revoked source is a failed or deferred call, never a completed memo. Bind-dependent HTTP tests require an environment that permits listeners; the generic backend stdio protocol test runs without one. Required integration gates must still run before merge.
