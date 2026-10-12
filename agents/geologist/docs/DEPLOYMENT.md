# Running and deploying Geologist

Geowiz HTTP requires configured identity/scopes and a dedicated credential.
Follow [backend access setup](../../../servers/geowiz/docs/HTTP_ACCESS.md), then
point `GEOWIZ_MCP_ACCESS_TOKEN_FILE` at that launcher's private credential file.
The installed [Python MCP client](../../../sdk/python/README.md) handles the
connection; model-provider keys cannot substitute for tool authority.

Geologist is a Python ADK employee that calls a separate Geowiz-compatible MCP
(Model Context Protocol) tool server. Its current mode is **Stand-alone Agent
with Progressive Disclosure (Skills)**. Local checks are verified; durable
employee operation and cloud deployment need the evidence described below.

The backend's [initial LAS review](../../../servers/geowiz/docs/LAS_REVIEW.md)
preserves measured inputs when optional annotation is unavailable. The
configured employee pair still requires its selected provider binding and
separate source grants. A successful local input review does not grant
persistence authority or qualify field interpretation.

## Start locally

Follow the ordered [portable execution guide](../../../docs/deployment-support.md#run-the-current-reference-locally):
build/start Geowiz separately, install the locked employee dependencies, inspect
the project and then configure model credentials for a live task.

Run from `agents/geologist`:

```bash
uv sync --frozen --extra eval
uv run --frozen pytest -q
uv run --frozen python -c 'from app.agent import app, root_agent; print(app.name, root_agent.name)'
agents-cli info
```

These checks verify package/import/project shape, not geological correctness.
The manifest currently reports deployment target `none` and in-memory sessions.

With a private development Geowiz at port 3001 and the chosen model credentials
resolved from the private [model profile](../../../docs/model-providers.md):

```bash
GEOLOGIST_MODEL_CONFIG_FILE=/absolute/private/models.json \
GEOWIZ_MCP_URL=http://127.0.0.1:3001/mcp \
  GEOWIZ_MCP_ACCESS_TOKEN_FILE="$HOME/.config/shaleyeah/geowiz/credential" agents-cli run \
  "Use assess_geowiz_quality on tests/sample-files/sample.las as LAS data"
```

The file path is read by Geowiz, relative to the Geowiz working directory. A
different host needs an approved file/connector path there. Provider/task
qualification remains #671/#674. Complete [private source setup](../../../servers/geowiz/docs/DATA_SOURCES.md)
before file-based tool calls; the backend enforces source grants independently.

## Configuration and ports

| Setting | Current value / purpose |
| --- | --- |
| `GEOWIZ_MCP_URL` | Defaults to `http://127.0.0.1:3001/mcp`; HTTPS for remote compatible endpoints |
| `GEOWIZ_MCP_ACCESS_TOKEN_FILE` | Required private dedicated credential reference; the server's policy supplies scopes |
| Transport limits | `GEOWIZ_MCP_TIMEOUT_SECONDS=30`, `GEOWIZ_MCP_REQUEST_TIMEOUT_SECONDS=10`, `GEOWIZ_MCP_PREFLIGHT_ATTEMPTS=2`; see [client bounds](../../../sdk/python/README.md) |
| `GEOLOGIST_MODEL_CONFIG_FILE` | Required for model execution; owned private Gemini/Anthropic production profiles and optional separate judge |
| Geowiz synthesis profile | Same production provider and owner; Geowiz HTTP `modelConfigFile` references that profile |
| Employee port | No fixed production port; CLI run manages its local server |
| Optional playground | `agents-cli playground --host 127.0.0.1 --port 8000` explicitly binds a development UI |

Resolve real credentials outside commands, prompts, logs and saved context.
The reference [provider contract](../../../docs/model-providers.md) is implemented; selecting ADK or a
host does not certify BYO providers or another employee runtime.

## State and human review

The CLI development session remains in memory. Embed the
[retained working-context runtime](WORKING_CONTEXT.md) for native ADK/SQLite
restart, bounded current context and scoped export/deletion. Supply authenticated
principal/source callbacks and an owned persistent directory. The runtime
rejects a second native writer; replication is unqualified. Revision-bound
human review and protected continuation remain #673.

The agent may prepare analysis for review. Saving a finding goes through ADK
confirmation; the executing backend must also enforce identity, source access
and the reviewed revision before consequential use. A direct MCP call is not
protected by that UI confirmation. Professional geological approval stays with
the human; unsupported inputs/results must be surfaced.

The backend currently writes JSON findings under its working directory's
`data/geowiz/findings`. Those files are not a complete employee context,
approval or audit backup. See the [state/recovery requirements](../../../docs/deployment-support.md#durable-state-recovery-and-resource-qualification)
for persistent volumes, export/restore, stale approval and access tests.

## Containers, scaling and hosted targets

The [support matrix](../../../docs/deployment-support.md#support-matrix) is the
source of current qualification. #674 supplies independent packages/images and
the local/container journey; no reference container recipe or hosted deployment
is shipped by this page. VM, Fly.io, Cloud Run, GKE and Agent Runtime are optional,
untested targets until their own receipts pass.

Scaling needs verified shared state, review/audit behavior and MCP session
isolation. Do not infer stateless operation or replica safety from a separate
tool process. Geologist requires no warehouse, vector database or coordinator.

## Verification before changing support

Record exact packages/locks/models, image digests, identity/source policy and
commands. Prove independent install, a reviewed task, failure/deferral,
restart/change-of-input, export/restore and composition with a compatible
external tool. Configured evaluations and professional acceptance are separate
from package shape checks. The [MVP delivery plan](../../../docs/mvp-release-plan.md)
names the implementation and release gates.

Frozen evaluation reports run locally through `app.eval_adapter`; see
[local grading](LOCAL_TESTING.md#run-adk-evals). Install runtime dependencies with
`uv sync --locked --no-dev` for the deployed employee. Google's heavier local
evaluation tooling is in the development group. Supply authenticated host
evidence and an explicit independent private judge for real scoring. Reports
do not persist context, grant approval or qualify a deployment.

## Private event export

Install client 0.2.0, contracts 0.3.0 and evaluations 0.2.1 with the agent wheel.
Set optional `GEOLOGIST_EVENT_CONFIG_FILE` to the owned private settings file
matching the approved assignment and backend binding. Keep separate producer
logs, protected parent directories and operator retention.
[Event setup](../../../docs/employee-events.md#configure-private-local-files)
explains required/optional sink behavior and uncertain effects. Logging a review
attestation does not supply reviewer authentication or a persistence grant.
