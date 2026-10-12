# Local Testing — Geologist ADK Agent + Geowiz

The Geologist agent is ADK/Python. The Geowiz server is the TypeScript MCP backend it calls over HTTP.

## Verify The Agent Package

```bash
cd agents/geologist
uv sync --frozen --extra eval
uv run --frozen pytest -q
uv run --frozen python -m py_compile app/agent.py app/geowiz_mcp.py
uv run --frozen python -c 'from app.agent import app, root_agent; print(app.name, root_agent.name)'
agents-cli info
```

`agents-cli info` should detect `agents/geologist` as the project. It should not require or create ADK files at repo root.

## Run With A Live Geowiz Backend

The initial [LAS review contract](../../../servers/geowiz/docs/LAS_REVIEW.md)
returns measurements, supplied assumptions and unknown geology. Its parser/QC
tests run from the server package with `pnpm test:las`; employee argument,
source/hash, native-provider, event and confirmation checks stay in Python.
Research-based sample review does not certify field interpretation.

First complete the [ordered build/config setup](../../../docs/deployment-support.md#run-the-current-reference-locally).
Geowiz now requires configured MCP credentials/scopes. Start its
[private HTTP launcher](../../../servers/geowiz/docs/HTTP_ACCESS.md) and run the
generic-client boundary test there. Use the launcher's private credential file
for `GEOWIZ_MCP_ACCESS_TOKEN_FILE`; model credentials are separate. The sample
policy grants only the quality read, whose current metrics are fixed.

For a no-model interoperability control, after the builds, run from repo root:

```bash
uv run --project agents/geologist --locked python sdk/python/scripts/check_geowiz.py
bash sdk/python/scripts/check-isolation.sh
```

These start a temporary protected backend and test isolated installed wheels.
They do not accept a geological interpretation or a human-review workflow.

With model configuration ready, run the ADK agent:

```bash
cd agents/geologist
GEOWIZ_MCP_URL=http://127.0.0.1:3001/mcp \
  GEOWIZ_MCP_ACCESS_TOKEN_FILE="$HOME/.config/shaleyeah/geowiz/credential" agents-cli run \
  "Use assess_geowiz_quality on tests/sample-files/sample.las as LAS data"
```

With model credentials configured, this exercises `app/agent.py` and
`app/geowiz_mcp.py`. The fixture resolves on the Geowiz host from its working
directory, not on the employee host. Import/health alone does not execute it.

## Run ADK Evals

The [reference dataset](../tests/eval/datasets/geologist-adk-reference.json)
contains control, sparse-context and unapproved-persistence cases. The
[data-only profile](../tests/eval/eval_config.json) selects installed metrics,
reviewed dataset hashes, thresholds, weights and a versioned judge reference.
Validate it from `agents/geologist`:

```sh
uv run --locked python -m shaleyeah_evaluations tests/eval/eval_config.json \
  --role geologist \
  --dataset geologist.reference=tests/eval/datasets/geologist-adk-reference.json
```

This validates configuration and exact dataset bytes; it runs no employee or
judge. [The evaluation package](../../../evaluations/README.md) has frozen-trace
conformance tests for schema/scope, provenance, freshness, assumptions, authority,
role tool/architecture and observed confirmation checks. Missing runtime evidence
or an unexecuted judge cannot PASS. These checks cannot approve geological work.

The portable profile is not a stock `agents-cli` grading configuration. The
[performance profile](../tests/eval/performance_profile.json), version 0.2.0,
selects observed architecture checks and literal numeric/unit comparisons against
[the demo LAS](../tests/eval/fixtures/sample.las). Its log date is 2024-01-15.
The historical clock in the control is intentional; the stale-source case uses
2026-10-11 and blocks. These fixtures qualify literal data and policy behavior,
not professional geological interpretation or current customer data.

From `agents/geologist`, grade the authored fixture dataset:

```sh
uv run --locked python tests/eval/run_fixture_evals.py \
  --output artifacts/evals/fixture-results.json
```

The command writes portable reports and prints each case outcome. Two controls
pass; missing/stale evidence, wrong units, invented depth and unauthorized writes
block. The qualitative judge is scripted, review is synthetic, and absent human
measurements remain absent. The reports identify this as fixture evidence. Native
provider journey tests separately run real ADK and its save-confirmation pause
against explicit offline Gemini/Anthropic transports.

For actual frozen native traces, an authenticated host supplies a private JSON
file with `candidate`, `contexts`, `workProducts` and optional per-case
`measurements`. `contexts` maps every dataset case ID to the separately observed
scope, task/product revision, clock, source artifacts and runtime observations
accepted by `EvaluationContext.from_trusted_runtime`. `workProducts` maps case IDs
to canonical products. Keep this host file owner-only (mode 0600); copying model
`runtime_evidence` into it would defeat the trust boundary. Capture verified source
references and literal/expert-reviewed answers in `reference_findings`; the model
cannot define its own expected values. Dataset and profile hashes must match.

```sh
uv run --locked python -m app.eval_adapter \
  --profile tests/eval/performance_profile.json \
  --dataset geologist.performance=tests/eval/datasets/geologist-performance.json \
  --traces /absolute/path/native-traces.json \
  --host-evidence /absolute/path/private-host-evidence.json
```

This prints JSON reports. Exit 0 means grading completed; inspect report status
and `promotionBlocked` for the outcome. Without a configured judge, otherwise
valid cases report `infra-error`, never PASS. `--models` explicitly selects the
private [BYO configuration](../../../docs/model-providers.md), including a separate
`purpose: judge` credential reference. Match the profile judge reference to that
reviewed private judge revision. The adapter checks customer/employee ownership,
records model/judge versions and uses the existing bounded native model client.
This option makes a provider request; CI does not use a live key.

Native traces may come from pinned `agents-cli` 1.3.1 generation or ADK Runner
2.4.0. Record the actual generating harness in `candidate.harness`, and the exact
model/runtime version in the candidate. Each trace must contain exactly one
`responses` candidate; split multi-candidate files explicitly. Google local SDK
callbacks use an installed callable from `vertex_metrics(...)`, not profile Python
or `custom_function` compilation. Google SDK 1.160.0 is pinned; the evaluation
extra is a development dependency. Generated traces alone do not supply trusted
work products, source or authority observations. The host must bind those inputs.

Promotion gates follow in #577. Actual source/employee/context/restartable review
qualification remains #671/#672/#673. No fixture or judge score can approve geology,
persist employee memory or decide an investment.

## Correlated trace controls

From this package:

```sh
uv run --locked pytest -q tests/test_employee_events.py tests/test_native_employee_events.py
```

These tests
cover exact host bindings, native model versions, confirmation pauses and actual
protected Geowiz correlation for offline Gemini/Anthropic. Generate private
[operator-readable JSONL](../../../docs/employee-events.md#generate-an-operator-readable-fixture-trace)
with the documented export command. Authored review measurements are fixtures,
not observed human acceptance. The installed-wheel test separately verifies host
hooks and client export without monorepo imports. For grading, optional
`--events /absolute/private/agent-events.json` records the completed reports
against matching scope/revision/qualification.
