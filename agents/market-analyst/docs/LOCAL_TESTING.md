# Test Market Analyst locally

From `agents/market-analyst`:

```sh
uv sync --locked
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
agents-cli info
uv run --locked python tests/eval/run_fixture_evals.py --output /private/tmp/NEW-market-fixtures.json
```

Tests use fictional source data and offline provider transports. They check MCP
argument/result contracts, actual final-output parsing, context isolation,
restart, current source rights and the frozen scorecard. The compatible external
MCP fixture binds a loopback listener; it imports neither this employee nor the
Market backend. It verifies successful current client calls and actual HTTP denial
for missing or wrong credentials before dispatch, with private error details hidden.

From `servers/market`, run `pnpm build`, `pnpm lint` and `pnpm test`. Its native
context test starts the actual protected backend, runs both scripted provider
transports, captures actual tool events and returned work, grades the result,
creates installed qualification evidence and uses the separate human CLI before
resuming across restart. The independent extraction/container checks repeat the
journey using declared artifacts; see the backend's local testing guide.

An environment that denies a loopback bind leaves HTTP integration unverified.
An `EPERM` bind failure is a permission restriction; an occupied port normally
reports `EADDRINUSE`. Tests request an OS-assigned port. Keep the native HTTP and
container checks required in CI; a local restriction must not become a pass.

For a live task, configure the backend's protected HTTP access and private input
exports, then provide the employee model profile and MCP token references from
the README. Live credentials are optional for technical fixtures. A paid feed or
professional review is not implied by a fixture pass.
