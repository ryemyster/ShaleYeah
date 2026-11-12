# Risk Analyst
Gaius Probabilis Assessor prepares a source-linked appraisal of declared downside scenarios for a human risk owner. The employee reads a risk register, operator risk policy and complete joint scenarios through the independent [Risk Analysis backend](../../servers/risk-analysis/README.md).

The selected mode is **Stand-alone Agent with Progressive Disclosure (Skills)**. It loads exact evidence when needed, retains its own scoped working context and calls bounded tools. An enrolled human reviews the exact inputs and work before a private record can be saved.

## Inputs and output
The backend accepts three normalized JSON exports: a register with specialist references and severity rationale, a policy defining coverage and limits, and complete joint states with integer probability weights and residual losses. Currency, horizon and dependence are explicit.

The employee returns exactly `{"work": ..., "risk": ...}`, copied from the current successful draft. Missing inputs produce an explicit JSON deferral. Expected loss, weighted-CDF loss quantiles, tail probability, indicator correlations, policy blockers and limitations remain visible. These are conditional calculations from declared assumptions; they do not establish field probabilities or professional risk acceptance.

## Run and check
From this directory:
```sh
uv sync --locked
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
agents-cli info
uv run --locked python tests/eval/run_fixture_evals.py --output artifacts/evals/risk.json --code-revision FULL_TESTED_COMMIT_SHA
```
The last command writes a frozen technical decision, not human sign-off. Replace the revision placeholder with the actual tested commit. Tests use offline provider fixtures; the compatible external-tool test starts a loopback listener.

For a configured model, set `RISK_ANALYST_MODEL_CONFIG_FILE` to an owner-only [model profile](../../docs/model-providers.md) with explicit Gemini or Anthropic IDs and private credential references. Set `RISK_ANALYSIS_MCP_URL` and `RISK_ANALYSIS_MCP_ACCESS_TOKEN_FILE` separately for the backend. Remote endpoints use HTTPS; loopback HTTP must be explicitly allowed by the installed client.

```sh
agents-cli run "Read task.risk revision r1, appraise joint.fixture revision r1 and prepare exact human risk review"
```
This requires an authorized backend task and matching source/configuration revisions. It can contact the selected paid model. No provider credential is needed for the fixture checks above.

## Review and context
`RiskAnalystRuntime.open` embeds the installed native runtime with an operator-owned context catalog and current source-authority callbacks. The simple CLI app uses its host's session lifecycle; durable restart guarantees require the retained runtime. The native integration fixture exercises that path.

Human inspect/change/reject/approve operations use the backend's separate [review API and CLI](../../servers/risk-analysis/docs/INTEGRATION.md). Installed qualification is required before approval and recording. Native confirmation and model prose cannot waive risk policy, accept residual risk, commit capital or certify compliance. Changed or revoked sources require fresh calculation and review.

See [architecture](docs/ARCHITECTURE.md), [integration](docs/INTEGRATION.md), [evaluation](docs/EVALUATIONS.md), [local testing](docs/LOCAL_TESTING.md) and [deployment](docs/DEPLOYMENT.md).
