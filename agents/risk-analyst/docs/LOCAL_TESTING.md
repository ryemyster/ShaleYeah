# Local Risk Analyst checks
From this directory, install with `uv sync --locked`, then run `uv run --locked pytest -q --cov=app --cov-fail-under=90`. These fixtures need no paid keys. The external MCP fixture needs permission to bind loopback.

The matching backend suite runs a real protected MCP server against the native employee with offline Gemini and Anthropic responses. It checks actual output, all three source identities, pending-review restart, installed qualification, enrolled human approval, idempotent resume and revocation. See the backend's [local checks](../../../servers/risk-analysis/docs/LOCAL_TESTING.md).

Export the two resulting native traces with `tests/eval/export_cli_traces.py` before Google grading. Install the pinned grading dependencies in a separate environment; they are not employee runtime dependencies. [Evaluation instructions](EVALUATIONS.md) explain the scorecard and limits.

Missing credentials or unauthorized source access must fail explicitly. A missing backend is resolved by starting an authorized server using its private binding and HTTP configuration. Setting a port alone does not grant access.
