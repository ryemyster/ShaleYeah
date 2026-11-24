# Title Analyst

Titulus Verificatus prepares an instrument-cited ownership and exception packet for a human title/land reviewer. It reads supplied instruments, keeps interest kinds and depth intervals separate, requests exact calculations, and proposes observations through the independent [Title MCP backend](../../servers/title/README.md).

The selected mode is **Stand-alone Agent with Progressive Disclosure (Skills)**. One specialist loads source detail on demand and keeps its own scoped working context. A separately enrolled human reviews the exact packet and qualification evidence before it can be recorded privately.

## Inputs and output

The backend accepts three exact JSON exports: examination scope, an instrument corpus, and a declared calculation/coverage policy. Opening holdings, normalized terms, record order and source validity are operator-attested assumptions. See the [input contract](../../servers/title/docs/INPUTS.md).

The employee returns exactly `{"work": ..., "title": ...}` from its latest successful draft, or `{"deferred":"..."}`. The packet preserves rational holdings/NRI, original-text citations, missing records, questions and conflicts. Citation identity does not establish that a proposed interpretation follows from the text.

## Run and check

From this directory:

```sh
uv sync --locked
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
agents-cli info
uv run --locked python tests/eval/run_fixture_evals.py --output artifacts/evals/title.json --code-revision FULL_TESTED_COMMIT_SHA
```

Use the actual tested commit for the revision placeholder. Fixtures require no provider key. Full HTTP tests need a host that permits a loopback listener. A technical pass keeps professional acceptance and promotion false. See [evaluation](docs/EVALUATIONS.md).

For a model run, set `TITLE_ANALYST_MODEL_CONFIG_FILE` to an owner-only [model profile](../../docs/model-providers.md) with explicit Gemini or Anthropic model IDs and private credential references. Set `TITLE_MCP_URL` and `TITLE_MCP_ACCESS_TOKEN_FILE` separately for the authorized backend. The default backend address is `http://127.0.0.1:3010/mcp`; the role configuration helper permits HTTP on loopback. Remote endpoints use HTTPS. `TITLE_ANALYST_EVENT_CONFIG_FILE` selects private event configuration.

```sh
agents-cli run "Read task.title revision r1, inspect the supplied instruments and draft an ownership/exception packet for title review"
```

This requires matching authorized task/source revisions and a configured model, and can contact the selected paid provider. No source-less ownership estimate is available.

## Review and retained context

`TitleAnalystRuntime.open` embeds the installed employee runtime with an operator-owned context catalog and current source-authority callbacks. Durable restart and revision invalidation require that retained runtime; the simple CLI app uses its host's session lifecycle. Verified backend work can enter private review context. Raw model output cannot promote itself to shared knowledge.

Human inspection, change requests, rejection and approval use the separate [review API/CLI](../../servers/title/docs/INTEGRATION.md). Installed qualification precedes approval and recording. Private recording grants no title clearance, marketability certification, legal opinion, curative execution, instrument filing, external transfer, lease acceptance or capital authority. Reviewer enrollment is operator-attested, not automated license verification.

See [architecture](docs/ARCHITECTURE.md), [integration](docs/INTEGRATION.md), [local testing](docs/LOCAL_TESTING.md) and [deployment](docs/DEPLOYMENT.md).
