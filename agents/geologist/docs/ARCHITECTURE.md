# Architecture — Geologist ADK Agent

`agents/geologist` is the package-local ADK/Python project for the Geologist role. The monorepo root remains workspace coordination only.

## Package Boundary

| Path | Purpose |
|------|---------|
| `agents-cli-manifest.yaml` | agents-cli project marker for this package |
| `.agents-cli-spec.md` | reference-pair spec and package boundary |
| `pyproject.toml` | Python ADK dependencies |
| `app/agent.py` | ADK `root_agent`, instructions, model choice, and tool registration |
| `app/geowiz_mcp.py` | Geowiz role mappings/configuration using installed `shaleyeah-mcp-client` |
| `app/working_context.py` | Role-local SQLite catalog, canonical records, dependency invalidation and bounded selection |
| `app/context_runtime.py` | Native ADK session/runner binding and current-source dispatch gate |
| `tests/` | pytest shape/result-boundary tests plus ADK eval dataset/config |
| `servers/geowiz` | independent TypeScript MCP backend |

## Architecture Mode

Primary mode: **Stand-alone Agent with Progressive Disclosure (Skills)**.

Geologist is a stand-alone specialist that equips package-local instructions, eval criteria, and Geowiz MCP tools when geological diligence is requested. It is not a hierarchical orchestrator, graph workflow, ambient event-driven agent, or capability-first arbitrator in #597.

Graph-based workflow is reserved for a later issue if geology review needs deterministic nodes, conditional routes, stateful sessions, or explicit HITL gates as workflow nodes.

## Execution Path

```
ADK runner / agents-cli
  |
  v
app/agent.py
  |
  |-- geowiz_backend_status()
  |-- plan_geowiz_tool_call()
  |-- analyze_geowiz_formation()
  |-- assess_geowiz_quality()
  |-- process_geowiz_well_logs()
  |-- process_geowiz_gis()
  |-- process_geowiz_access_database()
  |-- process_geowiz_document()
  |-- process_geowiz_seismic_data()
  |-- process_geowiz_aries_database()
  `-- save_geowiz_finding() with ADK confirmation
       |
       v
app/geowiz_mcp.py
       |
       v
GEOWIZ_MCP_URL, default http://127.0.0.1:3001/mcp
       |
       v
servers/geowiz
```

## Tool Parity

| Geowiz MCP tool | ADK Python wrapper |
|-----------------|--------------------|
| `analyze_formation` | `analyze_geowiz_formation` |
| `assess_quality` | `assess_geowiz_quality` |
| `process_well_logs` | `process_geowiz_well_logs` |
| `process_gis` | `process_geowiz_gis` |
| `process_access_database` | `process_geowiz_access_database` |
| `process_document` | `process_geowiz_document` |
| `process_seismic_data` | `process_geowiz_seismic_data` |
| `process_aries_database` | `process_geowiz_aries_database` |
| `save_finding` | `save_geowiz_finding` with `FunctionTool(..., require_confirmation=True)` |

## MCP result boundary

The installed [Python MCP client](../../../sdk/python/README.md) initializes the configured backend, discovers its tools in at most
32 pages, rejects missing/duplicate names or repeated cursors, and validates
arguments against the selected advertised input schema. Successful structured
results are validated against any advertised output schema using JSON Schema
validation. The installed MCP client also performs output-schema checks.

The wrapper returns backend/tool identifiers, original `content`,
`structuredContent` and `isError`. Structured-only success is retained. JSON
compatibility text must match structured evidence; conflicts or schema failures
raise a runtime error rather than return valid work. Error results retain their
native details and are separate from the successful output schema.

For legacy tools without an output schema, original JSON text remains supported.
Known failure markers survive the former `success`/`data`/`analysis` wrappers;
nesting beyond the supported three wrapper levels fails closed. The SDK now
preserves factory envelopes instead of adding the former extra outer `data`.
An invocation may return partial/draft output; this wrapper does not mark a
business task completed, approve a finding or promote employee memory.

The role's `test_mcp_result_contract.py` checks tool mapping and genuine failure
passthrough. Shared conformance tests cover schemas, errors and discovery.
Credentials resolve from a dedicated private file before connection; validated
destinations exclude URL credentials/query strings, redirects and ambient proxy
trust. Setup retries are bounded; a dispatched tool is never automatically
replayed. Cancellation propagates, and later calls use a fresh session.
`MCPClientError` exposes safe codes/categories and conservative effect uncertainty.

CI checks client/role behavior, wheel isolation and actual protected Geowiz
interoperability. These do not prove geological accuracy or real ADK review.
Actual reference tool schemas/formats and the full employee journey remain
#671/#674; durable review/restart remains #673.

## Eval Harness

Behavior evals live under `tests/eval/`.

| File | Purpose |
|------|---------|
| `tests/eval/datasets/geologist-adk-reference.json` | Control, edge, and capability-boundary cases for ADK tool selection |
| `tests/eval/eval_config.json` | Registered deterministic trust/role metrics, config tuning and optional judge rubric |

The installed [evaluation package](../../../evaluations/README.md) validates
this profile and exact dataset bytes. It grades frozen observations with a
trusted registry; config contains no executable evaluator. The host supplies
scope, source artifacts and runtime observations separately from model output.
Missing evidence cannot pass, and mandatory gates cannot be weakened or averaged
away. Geologist remains a Stand-alone Agent with Progressive Disclosure (Skills).
`app/eval_adapter.py` accepts pinned native traces and supplies installed
callbacks to Google's local evaluation API. The framework-independent runner
emits scoped reports; its source-bound numeric and observed architecture gates
replace response-word checks for performance. Independent private BYO judge
configuration supplies qualitative scores only. Missing judges are infrastructure
errors; failed authority/provenance gates block before judge calls. Human approval
and geological correctness remain independent review boundaries.
See [local testing](LOCAL_TESTING.md#run-adk-evals) for the current validation
command and what its result proves.

## Runtime Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `GEOWIZ_MCP_URL` | `http://127.0.0.1:3001/mcp` | Geowiz-compatible MCP backend URL |
| `GEOLOGIST_MODEL_CONFIG_FILE` | None | Private production/judge profile; [setup](../../../docs/model-providers.md) |

The agent does not depend on the orchestrator or any other agent. It can run standalone as long as a compatible Geowiz MCP backend is reachable when execution tools are invoked.

## Reference model bindings

The [initial LAS input review](../../../servers/geowiz/docs/LAS_REVIEW.md)
distinguishes measured curve coverage, explicitly supplied density assumptions
and unavailable geology. Employee wrappers can forward complete scenario inputs;
they do not choose missing rock/fluid defaults. Optional backend model notes
remain unreviewed. Professional interpretation, persistence approval and
restart-safe human continuation require their separate qualification.

Geologist and Geowiz use explicit Gemini or Anthropic profiles, fixed model IDs,
private owner-scoped credential references, bounded calls and independent judge
configuration. Geologist remains Stand-alone Agent with Progressive Disclosure
(Skills); provider configuration adds no orchestration or approval authority.
Missing/unsupported configuration and synthesis failures are explicit errors.
See [configuration and offline qualification](../../../docs/model-providers.md).

## Correlated observations

`app/employee_events.py` provides host hooks and installed native ADK callbacks.
`app/geowiz_mcp.py` forwards the bound emitter to the installed client; eval export
stays in `app/eval_adapter.py`. The employee remains **Stand-alone Agent with
Progressive Disclosure (Skills)** with its existing model budget and save gate.
No new reasoning loop, child-agent delegation or workflow authority is added.
[Event semantics](../../../docs/employee-events.md) separate model latency,
confidence and observed human rework, and preserve failed/blocked grades.

## Retained working context

The [working-context adapter](WORKING_CONTEXT.md) separates private task/work
records, source metadata, reference-only checkpoint recovery and explicitly
reviewed reusable knowledge. Native ADK `DatabaseSessionService` uses SQLite;
the catalog checks authenticated scope, current source/review receipts, metadata
revisions and dependency state before body retrieval and model dispatch. Historical
conversation is retained privately but only current-turn contents plus qualified
context enter the model. A sealed request hash prevents mutation after counting.

Selected Gemini/Anthropic token counters share pinned native serialization with
generation. Required references, uncertainty, pending decisions and conflicts
cannot disappear to make a budget pass. Context blocks produce blocked employee
events; an unexecuted model is not logged as a success. Scoped export/restore
preserves original expiry and current deletion markers. The adapter has a single
native writer, owned private files and explicit expiry purge. Business schemas
remain independent of the framework; no warehouse or coordinator is introduced.
