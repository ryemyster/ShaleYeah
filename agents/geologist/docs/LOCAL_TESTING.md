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

The profile is the portable interchange format, not a stock `agents-cli` grading
config. [Issue #667](https://github.com/ryemyster/ShaleYeah/issues/667) connects the
profile and trusted registry to ADK generation/grading and run reports. Until
that adapter lands, keep native provider/tool fixture tests as plumbing evidence;
do not pass this profile directly to `agents-cli eval grade` or imply live
scores. Promotion gates follow in #577. Several advertised source formats still
require #671 qualification. Actual model/domain evaluation needs approved
sources, private provider/judge credentials, versioned runtime evidence and
professional review; it remains separate from pytest and ADK confirmation.
