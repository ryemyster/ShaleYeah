# Drilling Engineer

Perforator Maximus prepares supplied drilling options and an evidence packet for a human drilling engineer. It checks design revisions, measured depth (MD) and true vertical depth (TVD), units and reference datums; reconciles quoted costs and sequential schedule phases; and surfaces hazards, missing evidence and offset applicability through the independent [Drilling MCP](../../servers/drilling/README.md).

The mode is **Stand-alone Agent with Progressive Disclosure (Skills)**. One native ADK specialist loads source detail on demand and keeps private scoped working context. A separately enrolled engineer reviews the exact packet before private recording.

The [input contract](../../servers/drilling/docs/INPUTS.md) uses three exact JSON exports: supplied well/design options, an evidence/offset/quote/schedule/hazard corpus, and reviewed constraints. Engineering component references and applicability are operator-attested. The role returns exactly `{"work": ..., "drilling": ...}` from its latest successful draft, or `{"deferred":"..."}`. Unknown evidence stays unknown. There are no default casing designs, mud weights, drilling speeds, cost-per-foot or risk scores.

## Run and check

From this directory:

```sh
uv sync --locked
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
agents-cli info
uv run --locked python tests/eval/run_fixture_evals.py --output artifacts/evals/drilling.json --code-revision FULL_TESTED_COMMIT_SHA
```

Use the actual tested commit. Fixtures require no provider key; full HTTP tests require a host that permits loopback listeners. A technical pass keeps professional acceptance and promotion false. See [evaluations](docs/EVALUATIONS.md).

For a model run, set `DRILLING_ENGINEER_MODEL_CONFIG_FILE` to an owner-only [model profile](../../docs/model-providers.md) with explicit Gemini or Anthropic IDs and private credential references. Set `DRILLING_MCP_URL` and `DRILLING_MCP_ACCESS_TOKEN_FILE` separately for the authorized backend. The default is `http://127.0.0.1:3003/mcp`; remote endpoints use HTTPS. `DRILLING_ENGINEER_EVENT_CONFIG_FILE` selects private audit configuration.

```sh
agents-cli run "Read task.drilling revision r1 and prepare the supplied drilling options and evidence for engineer review"
```

This requires matching task/source revisions and a configured model, and can contact the chosen paid provider. For durable scoped restart, embed `DrillingEngineerRuntime.open` with an operator-owned context catalog; the simple CLI app uses its host's session lifecycle. See [integration](docs/INTEGRATION.md).

Human inspection, change requests, rejection and approval use a separate [review API/CLI](../../servers/drilling/docs/INTEGRATION.md). Private recording grants no spud, authorization for expenditure (AFE) or capital commitment, field operations, well-control instructions, safety certification or professional engineering acceptance. Enrollment is operator-attested authority, not automated license verification.
