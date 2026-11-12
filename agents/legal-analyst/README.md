# Legal Analyst

Legatus Juridicus prepares a cited requirement/exception memo for a human legal reviewer. It reads the actual supplied provisions, compares declared jurisdiction and effective-date scope, and proposes issues through the independent [Legal MCP backend](../../servers/legal/README.md).

The selected mode is **Stand-alone Agent with Progressive Disclosure (Skills)**. The employee loads source detail when needed and uses its own scoped working context. A separately enrolled human reviews exact source, memo, context and evaluation revisions before a private advisory record can be saved.

## Inputs and output

The backend accepts three exact JSON exports: matter/questions, a corpus of versioned documents and provisions, and a coverage checklist with declared source conflicts. Contract text, primary law, guidance and counsel notes remain distinguishable. See the [input contract](../../servers/legal/docs/INPUTS.md).

The employee returns exactly `{"work": ..., "legal": ...}` from the latest successful draft, or an explicit JSON deferral. The memo preserves exact citations, declared applicability, missing questions/sources, exceptions and conflicts. Source metadata is operator-declared; citation validity does not prove that a legal interpretation follows from the quotation.

## Run and check

From this directory:

```sh
uv sync --locked
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
agents-cli info
uv run --locked python tests/eval/run_fixture_evals.py --output artifacts/evals/legal.json --code-revision FULL_TESTED_COMMIT_SHA
```

Replace the revision placeholder with the actual tested commit. Fixture tests need no provider key. The frozen decision is technical qualification, with professional acceptance explicitly false. See [evaluation](docs/EVALUATIONS.md).

For a model run, set `LEGAL_ANALYST_MODEL_CONFIG_FILE` to an owner-only [model profile](../../docs/model-providers.md) with explicit Gemini or Anthropic model IDs and private credential references. Set `LEGAL_MCP_URL` and `LEGAL_MCP_ACCESS_TOKEN_FILE` separately for the authorized backend. Remote endpoints use HTTPS; loopback HTTP requires explicit client configuration. `LEGAL_ANALYST_EVENT_CONFIG_FILE` selects private event configuration.

```sh
agents-cli run "Read task.legal revision r1, inspect the supplied provisions and draft a cited memo for human legal review"
```

This requires a configured model and matching authorized task/source revisions, and can contact the selected paid provider. Model credentials are resolved separately from backend credentials.

## Review and retained context

`LegalAnalystRuntime.open` embeds the installed native employee runtime with an operator-owned context catalog and current source-authority callbacks. Durable restart and input-revision guarantees require that retained runtime; the simple CLI app uses its host's session lifecycle. Verified backend work can be retained for review; raw model output cannot promote itself into shared knowledge.

Human inspect/change/reject/approve operations use the separate [review API/CLI](../../servers/legal/docs/INTEGRATION.md). Installed qualification is required before approval and recording. Model prose and native confirmation cannot grant legal clearance, contract/redline approval, signatures, filings, waivers, settlements or capital authority. Reviewer enrollment is operator-attested authority, not automated professional-license verification.

See [architecture](docs/ARCHITECTURE.md), [integration](docs/INTEGRATION.md), [local testing](docs/LOCAL_TESTING.md) and [deployment](docs/DEPLOYMENT.md).
