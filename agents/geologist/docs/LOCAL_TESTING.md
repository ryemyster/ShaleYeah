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
generic-client boundary test there. The current copied Python wrapper needs
#679's shared credential/destination client before the live pair can connect.
The package checks above remain available independently.

After that client integration and model configuration, run the ADK agent:

```bash
cd agents/geologist
GEOWIZ_MCP_URL=http://127.0.0.1:3001/mcp agents-cli run \
  "Use assess_geowiz_quality on tests/sample-files/sample.las as LAS data"
```

With model credentials configured, this exercises `app/agent.py` and
`app/geowiz_mcp.py`. The fixture resolves on the Geowiz host from its working
directory, not on the employee host. Import/health alone does not execute it.

## Run ADK Evals

The dataset is [geologist-adk-reference.json](../tests/eval/datasets/geologist-adk-reference.json);
metric selection/rubrics are [eval_config.yaml](../tests/eval/eval_config.yaml).
The files define intended control, sparse-context edge and unapproved-persistence
cases. Existing pytest checks inspect their shape; they do not execute or grade
the employee. Several advertised format cases still need source qualification.

From `agents/geologist`, inspect installed flags before a live run:

```bash
agents-cli eval run --help
```

When Geowiz, model credentials, approved inputs and the configured grading
service are ready, select the actual package files explicitly:

```bash
agents-cli eval run --dataset tests/eval/datasets/geologist-adk-reference.json \
  --config tests/eval/eval_config.yaml
```

For the inspected CLI 1.3.1, `run` chains inference and grading. Inference traces
go to `artifacts/traces/`; default timestamped JSON/HTML grade results go to
`artifacts/grade_results/`. This config includes a model-based judge; configure
its service identity/project separately from the agent/tool's model keys.
Live runs may incur cost and are not a credential-free CI step. Run only trusted
eval configuration; current custom metric functions execute code. Record source
commit, dataset/config/provider/model/judge versions, per-case scores and limits;
retain redacted artifacts and inspect failures instead of lowering thresholds.

No successful live eval is claimed by these setup instructions. Portable
declarative profiles/trusted metrics, the ADK adapter and promotion gates are
#666/#667/#577. Professional geological review and backend review/resume
enforcement remain separate from model scores and ADK confirmation.

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED localhost:3001` | Geowiz is not running | Use the configured HTTP launcher linked above |
| HTTP 401/403 from Geowiz | Missing identity or ingress permission | Adopt #679's credential-aware client and configured operator scopes |
| `agents-cli info` cannot find the project | Command was run from the wrong directory | `cd agents/geologist` |
| Python import error for `mcp` or `google.adk` | Dependencies are not installed | From this package, `uv sync --frozen --extra eval` |
| CLI cannot find default eval dataset | Generic scaffold filename differs from this package | Pass the explicit `--dataset` and `--config` shown above |
| Live inference/grading needs credentials | Model or selected grading service is not configured | Run no-key shape checks separately; configure the required identities before a live eval |

## See Also

- [README](../README.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DEVELOPMENT.md](DEVELOPMENT.md)
