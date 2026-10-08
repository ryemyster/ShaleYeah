# ADR 0004: replacement employees and tool composition

Status: accepted specification for Issue #572. Adapter implementation and runtime
qualification remain with the owners below. No transport, authorization service,
employee runtime or professional capability is installed by this decision.

## Purpose and durable boundary

An operator should be able to replace an employee's model, employee implementation,
tools, data source or coordinator independently. Bring your own (BYO) model/key
supplies a model endpoint and credential. BYO-agent replaces the employee that
does the job. A successful model switch proves only the first of those claims.

Every replacement keeps the same versioned job charter, task, evidence, work
product, context and review records from [the contracts package](../README.md).
Its professional cases come from the [role matrix](../../docs/employee-role-matrix.md)
and configured evaluation profile. This applies to all fourteen specialists,
including their own private context, and to an optional Chief of Staff.
Roman names are display identities; capability IDs describe the actual job.

Model Context Protocol (MCP) is the tool boundary. An employee/task adapter is a
separate boundary: it translates a selected runtime's task/artifact operations
into these business records. Neither exposes ADK (Agent Development Kit)
sessions, model messages or MCP sessions as employee memory or human authority.
[ADR 0002](0002-context-lifecycle.md) governs context;
[ADR 0003](0003-authority-and-review.md) governs access and human decisions.

This shared specification selects no new employee operating mode. Per
[ADR 0001](../../docs/adr/0001-durable-employee-contracts.md), a role declares its
primary standalone-with-skills, hierarchical, graph or ambient mode; capability
routing can supplement it. Composition does not force every specialist into a
hierarchy, require parallel child agents, or make a coordinator mandatory.

## Required compositions and optional variants

“Mandatory” means required qualification evidence before claiming this reference
composition works. It does not mean these combinations already pass in develop.
Fixture peers provide CI proof without paid accounts; named products need their
own versioned evidence. C6 becomes mandatory when claiming the coordinator pilot.

| ID | Composition | Requirement and minimum proof | Implementation owner |
| --- | --- | --- | --- |
| C1 | Our employee / our tools | Mandatory: Geologist + Geowiz preserve inputs, scoped context, results and reviewed continuation through the installed client | #674 and its prerequisites |
| C2 | Our employee / third-party MCP | Mandatory: a fixture MCP peer exposes explicitly mapped required capabilities and schemas; employee performs the same bounded task; unavailable capabilities fail explicitly | #677/#679/#674 |
| C3 | Third-party employee / our MCP | Mandatory: fake external employee uses installed contracts and an MCP client, with no ADK dependency; same evidence/review cases pass; generic-client calls also verify our tool boundary | #678/#674 |
| C4 | Employee without its paired MCP | Mandatory: bounded input-only task runs with permitted local artifacts; dependencies are declared; work requiring absent tools returns a blocker rather than inventing findings | #674 and role adoption |
| C5 | MCP without our employee | Mandatory: generic permitted MCP client discovers/calls tools; no agent/coordinator package or model credential is needed for the deterministic control | #668/#677/#678/#674 |
| C6 | Compatible external employee / optional Chief of Staff | Conditional: scoped delegation, artifact/review handoff, failure and restart; mandatory for the #676 pilot claim | #675/#676 with #674 |

All five #575 pairings, its reuse/swapability requirements, and its additional
trust/evaluation/context/portability comments are transferred here. #575 was
closed as superseded, not implemented. C6 includes its later external-employee
coordination requirement. Packages use installed contracts and declared client
dependencies; they must not copy schemas or import another package's source.

Optional variants include named third-party runtimes/tools, A2A (Agent2Agent),
alternative protocol revisions, streaming/push delivery, provider pairs and
hosted deployments. They cannot weaken mandatory context, source, human-review,
audit or cancellation requirements. A supported variant lists exact versions,
transport, capabilities, limits and passing cases. Unsupported variants return
an explicit compatibility failure before dispatch.

Open-source, internal and licensed source adapters use the same evidence/access
contract. CI uses synthetic permitted/denied sources without live credentials.
An operator supplies licensed access separately; a stub does not certify the
real product or permit export. Local/container portability is mandatory for the
reference proof; Cloud Run, Fly.io, GKE or another hosted service remains a
separately evidenced choice under #578/#674.

## Selected versions and research evidence

The implementation baseline is develop `4eccc57752dbc0b4f35a461bbbdcee45860e5d04`,
inspected on 2026-10-08. Dependency ranges and installed protocol constants are
different facts; this table records both. Re-check locks/constants on upgrades.

| Boundary | Selected profile / repository evidence | Qualification limit |
| --- | --- | --- |
| Employee records | Canonical JSON Schema 2020-12, `contractVersion: "0.1.0"`; [schema](../shaleyeah_contracts/schemas/employee-0.1.0.schema.json) and both validators | Only this exact employee version is implemented; structural comparisons do not authenticate or execute |
| MCP tool protocol | `2025-11-25`, initialized connection; stdio and Streamable HTTP reference profiles | Both need real client/server conformance in #674; legacy SSE, alternative revisions and MCP task features are not selected |
| TypeScript MCP | [sdk/package.json](../../sdk/package.json) declares `^1.29.0`; [workspace lock](../../pnpm-lock.yaml) resolves 1.29.0; installed `dist/esm/types.js` declares latest 2025-11-25 | SDK-supported historical revisions are not automatically qualified SHALE YEAH profiles |
| Python reference MCP | [Geologist metadata](../../agents/geologist/pyproject.toml) declares `>=1.13.0,<2`; [lock](../../agents/geologist/uv.lock) resolves 1.28.1; installed `mcp/types.py` declares latest 2025-11-25 | Other agents have their own locks; this evidence is for the reference package |
| Reference ADK | Same Geologist lock resolves `google-adk` 2.4.0 | ADK is our authoring choice, not a requirement imposed on external employees |
| A2A | Deferred: no configured `RemoteA2aAgent`/`to_a2a` path or `a2a-sdk` in the reference lock | No A2A transport/version is certified by this PR |

The [versioned MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
defines initialization, capability/version agreement and shutdown. The
[transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
defines stdio and Streamable HTTP. These are the sources for the selected tool
profile. Our current Python wrapper initializes before calling tools; the shared
TypeScript base has both transports but currently shares one HTTP transport.
Those paths establish starting behavior, not qualification or HTTP authority.

[MCP's official 2026-07-28 migration guide](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28)
describes a different per-request model. It is an optional future adapter profile;
do not mix its lifecycle with a pinned 2025-11-25 client or infer support from
new documentation. Its adoption needs an explicit versioned conformance change.

[A2A 1.0.0](https://a2a-protocol.org/v1.0.0/specification/) provides discovery,
task/artifact operations and interrupted states. Its wire version is `1.0`;
its part/interface format differs from 0.3. The installed ADK 2.4.0 distribution
metadata declares optional `a2a-sdk>=0.3.4,<0.4` under the `a2a` extra, which this
reference package does not install. [ADK's A2A documentation](https://adk.dev/a2a/)
labels the integration experimental. Therefore selecting ADK does not establish
A2A 1.0 compatibility. A future owner must pin a compatible implementation and
specification, choose its binding, test both ends and record limits before
advertising A2A. No guessed Agent Card or custom universal RPC is introduced here.

## MCP tool conformance requirements

1. Connect only to an operator-configured permitted endpoint/process. Complete
   `initialize`, agree an enabled protocol version/capabilities, then send
   `notifications/initialized`. Unsupported agreement closes without a tool call.
   Any allowed fallback needs its own explicit profile and cases; never choose
   “latest” or silently drop a required capability.
2. Discover all required tools through bounded `tools/list` pagination. Compare
   required names, input/output schemas and explicitly configured role-capability
   mappings. Descriptions and matching Roman names do not prove compatibility.
   Validate actual arguments/results against advertised schemas. Revalidate on
   reconnect or an advertised list-change notification; do not cache indefinitely.
3. Preserve structured success and error results through the client/employee
   path. The [MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
   distinguishes protocol errors from tool failures and defines `isError`,
   `structuredContent` and output schemas. This reference profile requires an
   output schema and structured success for its mapped tools, with consistent
   JSON text for compatibility clients. Other representations need an explicitly
   tested adapter. Failure must not become success because a text block exists.
   Validate success schemas separately from error results; preserve safe native
   failure details for deterministic retry/input/auth/permanent classification.
4. Declare query, command or discovery behavior in the tool contract. Read-only,
   idempotent or destructive annotations are untrusted hints, not access grants.
   Commands require backend enforcement of actual source/identity/review policy,
   including a generic client that bypasses employee prompts. Bound request/result
   size, pagination, timeout, retry and concurrency using trusted configuration.
5. Stdio stdout carries protocol messages only; diagnostics go through a redacted
   stderr/log sink. The launching operator supplies only necessary process
   credentials. Remote HTTP uses the authenticated boundary in ADR 0003 and the
   [selected authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).
   No token passthrough: each remote/source connection gets an intended-audience
   credential from its own trusted resolver. Model keys never become operator
   rights or agent payload fields. Authenticate each request independently of
   transport session IDs; retain correct profile headers and session cleanup.
6. Isolate clients and close/recover their transports without reusing another
   client's state. Declared optional resources/prompts/sampling/elicitation/MCP
   tasks are negotiated explicitly; none is required for the bounded reference
   control. HTTP health alone proves neither discovery nor access enforcement.

## Employee/task adapter requirements

The adapter exposes these abilities through its chosen installed runtime or
protocol. These are conformance requirements, not a new public service/API:

| Ability | Required behavior |
| --- | --- |
| Discover and admit | Declare supported employee record version, stable role/capability and input/output IDs, operating mode, review/input/cancel abilities and limits. Compare with separately trusted employee/customer policies; discovery claims cannot grant authority |
| Assign work | Accept validated task and bounded context in the exact assigned customer/asset/task/employee scope; resolve only permitted input references; persist assignment/revisions before execution |
| Observe work and artifacts | Retrieve durable task state and immutable artifact revisions with evidence, assumptions, units, uncertainty and blockers; actual bytes and rights must match references; native prose/artifact parts must be explicitly mapped |
| Request input or review | Surface missing input separately from human review; keep a stable task identity and exact current revisions, with a typed blocker or review request; no hidden model-only pause |
| Resume | Accept permitted revised inputs or authenticated decisions; revalidate source/context/policy and invalidate stale review; restart reconstructs from retained business state, not a socket/session identifier |
| Cancel or expire | Honor workload cancellation/deadline requirements, expose acknowledgement and unknown outcomes honestly, prevent unaccepted late-result promotion, and reconcile possible effects |

External employees can use any framework and their own permitted tools, including
none for a bounded task. Admission requires the full workload's capabilities;
merely returning correct JSON is insufficient. The scoped control records in
[composition-conformance.json](../fixtures/composition-conformance.json) show a
replacement Geologist without changing its job or human owner. They reuse the
canonical fixture records through declared patches rather than copied schemas.

Transport state and business state must stay separate. The mappings below use
semantic labels, not an unimplemented A2A wire enum. A future protocol adapter
must test its exact version's spelling and transitions.

| Transport observation | Business task / work outcome |
| --- | --- |
| Accepted/submitted | `assigned`; not evidence of work completion |
| Working | `running`; partial output remains `draft` |
| Input required | `blocked` with `missing_input` or another declared blocker; permitted corrected input resumes a revised assignment |
| Authentication required | `blocked` with `access_denied`/`authority_denied`; credential setup uses the trusted out-of-band path |
| Work ready but professional review absent | `awaiting_review`, `ready_for_review` work and exact `review-request` |
| Transport completed | Validate and persist complete artifacts first; remain `awaiting_review` where required. `completed` means business acceptance criteria and required review have actually passed |
| Transport failed/rejected | `failed` or `blocked` with the actual declared failure; rejected capability/authority never becomes fabricated successful work |
| Cancellation acknowledged before effect | `cancelled`; retained partial work cannot be promoted as accepted output |
| Timeout or uncertain effect | Record the adapter failure/outcome separately; use supported business state with explicit blocker when appropriate; do not invent a timeout enum or claim cancellation/rollback |

The current schema permits a structurally completed task with an artifact and an
unverified approval reference. Adapter checks must enforce the stronger business
acceptance rules above; validator acceptance cannot substitute for those checks.
`approve`, `reject` and `request_changes` remain authenticated human decisions,
not protocol completion, MCP elicitation or model prose. The receiving/executing
backend verifies the exact task/product/source/action binding under ADR 0003.

## Deadlines, cancellation and artifacts

Every admitted workload has trusted task deadline, tool timeout, retry budget,
cancellation grace and context/output limits. Passing a duration in model output
cannot enlarge them. The deterministic timeout fixture uses an injected clock,
1000 ms task deadline, 200 ms tool timeout, 100 ms cancellation grace and zero
retries; these are test values, not universal production defaults.

[MCP request cancellation](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation)
is best effort and refers to an in-flight request; it does not undo an external
effect, establish employee cancellation or replace an MCP task-specific operation.
Do not cancel initialization. When a workload needs stop-before-effect and the
peer cannot provide it, reject with `unsupported_capability` before dispatch.
Optional uncancellable read-only workloads require an explicit declared limit;
they may stop waiting but cannot claim the remote work stopped.

Cancel/complete races, duplicate events and process crashes require one durable
business outcome based on actual backend state. Late chunks/results are bounded
and retained only as unaccepted evidence. A possible external effect requires
reconciliation and idempotency safeguards; closing a connection never establishes
rollback. Partial streams cannot become final products from a “done” signal.
Artifact retrieval enforces scoped source rights, URI/path/egress restrictions,
actual digest/revision checks and redaction before retention or handoff.

## Fixtures, evidence and promotion

The fixture has two deliberately distinct parts:

- **34 executed validator cases**: the same record patches/options run in Python
  and TypeScript. They test external employee acceptance, task/context/review
  binding, version/enum/credential/framework/schema rejection, scope/revision
  mismatch, missing evidence and trusted capability/policy comparisons. Controls
  deliberately show that a syntactically valid hash or completed task does not
  prove bytes, review or execution. Tests leave supplied records unchanged.
- **28 specified adapter scenarios**: each has composition IDs, category, given
  inputs, action, expected observation and owners. `toolControl` is a synthetic
  initialize/list/call transcript for a generic client; `control.records` selects
  the external employee chain. These scenarios and transcript are not executed
  protocol/authentication tests in this package. Owners implement them against
  real adapters before claiming the compositions pass.

The generic echo tool proves only protocol mechanics. C2's employee journey
must also provide fixture implementations of the actual role's required tool
schemas/capabilities (or an explicitly tested mapping), and a configured fixture
model client. Echoing a URI does not qualify geological interpretation.

The shared record examples use placeholder source hashes and URNs. Runtime-test
owners must supply real fixture bytes, resolve the URI through a permitted local
fixture adapter, compute the actual digest, and replace that placeholder
consistently in work/context/evidence before testing source verification. Never
disable digest verification to make the synthetic record example pass.

Run `pnpm test` from `contracts/` for validator parity and coverage. The required
adapter evidence bundle records composition/profile, exact implementation locks,
fixture/version and trusted policy/eval versions, commands, captured redacted
inputs/results/events, expected/actual outcomes and failure limits. It includes
control, edge and capability-boundary cases, source/review denial, restart and
isolated installation without root-relative imports. No external keys are needed
for the fixture controls. A paid/live smoke claim needs separate recorded proof.

Conformance errors are judged deterministically, using existing business error
codes where their meaning applies (`unsupported_version`, `invalid_contract`,
`unsupported_capability`, `scope_mismatch`, `revision_mismatch`, `access_denied`,
`approval_required`). Native transport timeout/cancel errors remain adapter-local;
they do not add fields/enums to closed 0.1.0 records. Professional sufficiency
needs the domain expert and configured role scorecard. Optional LLM judges use
versioned rubrics under #666/#667; they cannot override deterministic policy or
grant human authority. Approval, escalation, deferral and reviewed-memory promotion
remain per-role gates. Failed/missing evals block candidate promotion under #577.

Upgrades replace adapters while preserving supported business records. Pin the
new implementation and protocol, add failing version/capability cases, run all
affected compositions plus the same job/context/trust/eval cases, and retain
rollback evidence. Business schema changes use the package's explicit version
rules; never rewrite payloads silently to make an old validator accept them.

## Retained paths, deletion and downstream ownership

No runtime path is displaced by this specification. Keep these active paths until
their replacements pass the required compositions; delete displaced helpers,
fixtures, commands and guidance in the replacement PR rather than alongside a
new parallel production path:

| Retained path / gap | Replacement and deletion owner |
| --- | --- |
| [Shared MCP base](../../sdk/src/mcp-server.ts): one HTTP transport, unstructured success/error text, direct unauthenticated tool dispatch and stdout diagnostics | #668 isolates sessions/lifecycle; #677 preserves schemas/errors; #678 enforces entry authority; #674 proves generic-client/stdio/HTTP behavior |
| [Geologist Python wrapper](../../agents/geologist/app/geowiz_mcp.py): initializes per call and selects named tools, with no full advertised-schema/structured-result negotiation | #679 supplies an installed reusable client; #677/#674 verify replacement; retain role tool mappings with their own tests |
| Other copied package-local MCP wrappers and four remaining TypeScript employees | #576 inventories exact callers; client adoption/role migrations remove displaced wrappers; #692 removes obsolete custom runtime after the last caller |
| Optional coordinator is not an implemented universal task router | #675 defines authority; #676 implements the bounded workflow and C6 adapter proof |
| Role/provider/source/context/review/eval behavior | #669/#670/#671/#672/#673/#666/#667/#574/#577 and role adoption; #674 collects reference extraction/qualified journey evidence |

This resolves #572's specification and all transferred #575 requirements. It
does not complete those implementation issues or certify a named external
runtime, connector, hosted deployment or professional workflow.
