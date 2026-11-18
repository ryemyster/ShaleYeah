# Local Economist tests

From this package, run:

```sh
uv sync --locked
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
uv run --locked python tests/eval/run_fixture_evals.py \
  --output artifacts/evals/economist.json --code-revision "$(git rev-parse HEAD)"
```

The Python tests cover role ownership, tool mappings, actual-output grading,
configurable mandatory gates, own context restart/revocation and a compatible
independent external MCP service. Model responses are offline fixtures.

From the repository root, build the declared tool dependencies with
`pnpm turbo build --filter=@shaleyeah/server-econobot...`, then run
`pnpm --dir servers/econobot test`. The native integration uses both configured
Gemini and Anthropic adapters against the actual protected service, separate human
inspection/qualification/approval, restart, exactly-once save and revoked access.
No paid key is required. It does not measure live model reasoning quality.
The package runs test files serially, and verifies pending-review restart in a
separate bounded process. Each subprocess keeps its deadline; slow aggregate
fixture setup cannot consume another business phase's budget.

For independent source, wheels and archives, run:

```sh
node servers/econobot/scripts/check-extraction.mjs \
  --bundle /absolute/empty/economist-bundle --report /absolute/extraction.json
python3 servers/econobot/scripts/check-containers.py \
  --bundle /absolute/economist-bundle --report /absolute/containers.json
```

Extraction installs declared artifacts outside the checkout and repeats behavior
checks. The container check requires a working Linux Docker daemon and separate
employee/tool images. A missing runtime produces a blocked receipt; it does not
count as success. Required CI records exact commit and artifact/image hashes.
