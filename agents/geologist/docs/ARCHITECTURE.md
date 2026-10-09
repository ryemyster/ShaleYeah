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
| `tests/eval/eval_config.yaml` | Deterministic hard-boundary checks plus LLM-judged response quality |

Run from `agents/geologist`:

```bash
agents-cli eval run
```

Use deterministic grading for hard rules such as tool-call expectations and "do not save without approval." Use an LLM judge only for subjective final-response quality.

## Runtime Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `GEOWIZ_MCP_URL` | `http://127.0.0.1:3001/mcp` | Geowiz-compatible MCP backend URL |
| `GEOLOGIST_MODEL_CONFIG_FILE` | None | Private production/judge profile; [setup](../../../docs/model-providers.md) |

The agent does not depend on the orchestrator or any other agent. It can run standalone as long as a compatible Geowiz MCP backend is reachable when execution tools are invoked.

## Reference model bindings

Geologist and Geowiz use explicit Gemini or Anthropic profiles, fixed model IDs,
private owner-scoped credential references, bounded calls and independent judge
configuration. Geologist remains Stand-alone Agent with Progressive Disclosure
(Skills); provider configuration adds no orchestration or approval authority.
Missing/unsupported configuration and synthesis failures are explicit errors.
See [configuration and offline qualification](../../../docs/model-providers.md).
