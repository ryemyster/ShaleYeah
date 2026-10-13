# Follow an employee's work

Employee events describe what happened without copying prompts, source files,
tool arguments/results or review prose into a log. The separate
[event profile 0.1.0](../contracts/shaleyeah_contracts/schemas/employee-events-0.1.0.schema.json)
is shared by Python and TypeScript. It requires no observability vendor,
warehouse, coordinator or agent framework. Package versions are contracts 0.3.0,
TypeScript SDK 0.2.0, Python client 0.2.0 and evaluations 0.2.1; existing employee,
source and evaluation wire profiles retain their own versions.

## Read a trace

Every event includes run/trace IDs, customer/asset/task/employee scope, task
revision, producer/version, unique event and stream IDs, sequence and observed
time. `qualification: fixture` identifies authored/offline test evidence; `live`
does not itself certify professional correctness or human acceptance.

| Event | What the reference records |
| --- | --- |
| `task`, `context` | Validated host assignment or selected-context manifest and its canonical hash |
| `work-product` | Exact product hash, source ID/revision/hash references and separately labeled model confidence |
| `model`, `agent` | Native ADK model requests and agent turns; configured model revision and optional provider-reported revision |
| `tool` | Client attempt and backend execution, including failure, blocked dispatch, retry and uncertain effects |
| `source` | Validated source identity/hash returned by formation analysis |
| `evaluation` | Portable report/profile hashes, candidate versions, actual grade status and observed performance measurements |
| `review` | Confirmation pause, request or host-verified decision on an exact revision |

Read each producer stream in `sequence` order; join client/backend operations
through `parentEventId` and `spanId`. A new emitter has a new `streamId`, so its
sequence may start at one after restart. Use event IDs to detect duplicates.
Wall clocks across hosts may differ; observed timestamps do not establish
causality. This follows the distinction between event and observation time in
the [OpenTelemetry log model](https://opentelemetry.io/docs/specs/otel/logs/data-model/).
The JSONL exporter is portable metadata, not an OpenTelemetry wire exporter.

Model latency and tool latency use monotonic elapsed time. Human review seconds,
corrections and rework are host-supplied observations, never inferred from model
confidence. Unmeasured values stay absent. An agent turn ending does not mean the
business task is completed, approved or professionally correct. Context events
record a validated manifest; actual access, freshness, retrieval, retention and
review continuation are enforced by their owning host services.

## Configure private local files

First complete [model setup](model-providers.md),
[Geowiz access](../servers/geowiz/docs/HTTP_ACCESS.md) and
[source setup](../servers/geowiz/docs/DATA_SOURCES.md). Obtain scope and revision
from the trusted assignment/source grant, not model output. Create two owner-only
JSON files under a protected directory outside the checkout. Each accepts exactly
these keys:

```json
{
  "version": "0.1.0",
  "context": {
    "runId": "approved-run-1",
    "traceId": "1234567890abcdef1234567890abcdef",
    "scope": {
      "customerId": "fixture",
      "assetId": "asset-1",
      "taskId": "task-1",
      "employeeId": "geologist"
    },
    "taskRevision": "r1",
    "qualification": "fixture"
  },
  "producer": {"id": "geologist", "version": "0.1.0"},
  "jsonlFile": "/absolute/private/agent-events.jsonl",
  "required": true,
  "timeoutMs": 5000
}
```

Replace the example context with the approved assignment. In the backend copy,
use the same context, producer `geowiz` version `1.0.0`, and a different absolute
JSONL path. Set both configuration files to mode 0600 and protect their parent
directories, normally mode 0700. Existing log files must be owned private regular
files with one link; final-component symlinks are rejected. Use one writer per
file. Operators own rotation, retention, backups and access to these files.

In the private Geowiz HTTP configuration, add
`"eventConfigFile": "/absolute/private/backend-events.json"` alongside
`sourceConfigFile`. Start its existing HTTP launcher. For Geologist, set
`GEOLOGIST_EVENT_CONFIG_FILE=/absolute/private/agent-events.json` alongside the
existing model and MCP credential settings. Event configuration contains no keys,
credential references or source locators.

The Python client passes correlation through native MCP `_meta` under
`org.shaleyeah/correlation`. The configured backend compares it with its trusted
event context and verified customer/employee principal before dispatch. It
rejects missing, mismatched or extra correlation fields. Metadata is a binding,
not an access credential. This file example binds one task; a multi-task host
selects a trusted emitter and applies `bindMCPEvents` for each assignment.
Authorization and source-access audit remain independent required boundaries.

## Choose failure behavior and exports

`required: true` blocks a model/agent start or tool dispatch when its preceding
event cannot be exported. If a tool was already dispatched when completion
export fails, the client reports `audit_unavailable` with an uncertain effect;
it never automatically replays the operation. A failed tool or invalid success
output cannot generate a successful backend completion event.

`required: false` preserves operation execution and increments emitter health
counters on export failure. Inspect `health.failures` and `lastErrorCode`; absent
events cannot prove successful auditing. Export waits count against enclosing
operation deadlines. A timed-out sink may finish later, so investigate the event
ID and uncertain effect before recovery. fsync and local serialization do not
certify multi-process durability, protected-action transactions or SIEM delivery.

Hosts can supply an async sink to `EventEmitter` for another local store or
optional SIEM export. Python uses `shaleyeah_mcp.events`; TypeScript exports the
emitter, `createJsonlSink`, `loadJsonlEmitter` and `bindMCPEvents` from
`@shaleyeah/sdk`. Portable validators/redaction live in
`shaleyeah_contracts.events` / `@shaleyeah/contracts/events` and import no runtime.
Only schema-allowed metadata reaches sinks. Unknown fields are dropped before
serialization; configured sensitive literals are redacted, and sensitive
ownership bindings fail rather than silently changing scope. Hosts must keep
sensitive prose out of allowed identifier fields and register known secret
literals. This is not general-purpose free-text anonymization.

## Record host work, evaluations and review

`app.employee_events.GeologistEvents` exposes `record_task`, `record_context`,
`record_work`, `record_evaluation`, `record_review_request` and `record_review`.
It validates records against the emitter's scope/revision and hashes canonical
JSON using RFC 8785. Work claiming approval still records review-required until
the separate verified review hook is called. Evaluation events preserve the
portable report's failure or missing-judge status.

The trusted host calls `record_review` only after authenticating the reviewer
and checking policy, request and product revision. Its `VerifiedReview` attestation
binds the complete decision hash, principal and policy/version. Constructing this
Python object does not authenticate a human, authorize a save or prevent replay.
The review service owns those controls and continuation. Native ADK confirmation
is a pause, not backend professional approval. Native callbacks use the
[installed ADK callback interfaces](https://adk.dev/callbacks/types-of-callbacks/)
and add no custom reasoning loop.

To log grading results, add `--events /absolute/private/agent-events.json` to the
[Geologist grading command](../agents/geologist/docs/LOCAL_TESTING.md#run-adk-evals).
The file context must match the report scope, task revision and qualification.
This adapter lives in the role package; the portable evaluation runner remains
independent of ADK and the MCP client.

## Generate an operator-readable fixture trace

After building contracts, connectors, SDK and Geowiz, run from the repository root:

```sh
export GEOLOGIST_EVENT_TRACE_DIR="$(mktemp -d)"
uv run --project agents/geologist --locked pytest -q \
  agents/geologist/tests/test_native_employee_events.py -k actual_protected
```

The new directory receives `gemini-agent.jsonl`, `gemini-geowiz.jsonl`,
`anthropic-agent.jsonl` and `anthropic-geowiz.jsonl`, each private and created
without overwriting an existing file. Read the JSON lines in a local editor and
join tool parents to client event IDs. The test uses actual native ADK and
protected Geowiz with offline provider transports and real permitted LAS bytes.
Assignment/context/work/review records and review measurements are authored
fixtures. No qualitative judge is supplied, so the example evaluation correctly
reports `infra-error` and blocks promotion. It is not live provider, authenticated
human-review, durable context/restart or professional acceptance evidence.

Package tests separately cover malformed/foreign metadata, real tool failures,
redaction, retries, export failure, sequence/restart ordering and stdio protocol
frames. Reference context/review qualification and fleet adoption remain with
their owning outcomes in the [MVP plan](mvp-release-plan.md).
