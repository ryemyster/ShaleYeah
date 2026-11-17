# Develop Market Analyst

Use this package's locked Python environment. The backend uses its own pnpm
commands. Follow the repository's issue-first, tests-first sequential SDLC.

```sh
uv sync --locked
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
agents-cli info
```

Add a failing contract test or frozen evaluation before changing behavior.
For a tool, preserve the executing backend schema, map arguments in
`app/market_mcp.py`, register it in the native agent and cover structured failures,
source scope and human authority. Keep model/provider and MCP credentials with
the trusted host. Do not add a second reasoning loop or custom transport.

The scorecard is declarative. Its registered source, transformation, region,
coverage and authority gates cannot be removed by profile tuning. Preserve old
reference/configuration bytes and results when publishing a reviewed revision.
Re-run actual-output grading after a prompt change. Supplementary Google local
trace grading checks exact output and tool trajectory, without a cloud judge.

Before shipping, update package docs and changelogs, remove displaced behavior,
run agent and backend checks plus independent extraction/container qualification,
and record evidence on the issue/PR. A green unit test suite alone does not
qualify the complete employee journey.
