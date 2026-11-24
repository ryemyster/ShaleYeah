# Test Title Analyst locally

From this package:

```sh
uv sync --locked
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
uv run --locked python -m compileall -q app
agents-cli info
uv run --locked python tests/eval/run_fixture_evals.py --output artifacts/evals/title.json --code-revision FULL_TESTED_COMMIT_SHA
```

Use the actual tested revision. These checks use fictional sources and offline provider responses. The compatible external MCP test binds an automatically assigned loopback port. Full backend native tests require that same host capability and exercise the installed employee against the actual protected Title server. Do not infer a port collision from a sandbox `EPERM` denial.

Run backend build/type/lint/tests from `servers/title`; run the source/archive/wheel command from [deployment](DEPLOYMENT.md). Required CI includes every test without deselection and grades actual native traces. Failed or unexecuted checks remain separate from passing unit coverage. Synthetic results do not measure professional accuracy or human effort saved.
