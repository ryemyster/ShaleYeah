# ADR 0003: trusted employee authority and revision-bound human approval

Status: accepted when the owning [authority policy issue](https://github.com/ryemyster/ShaleYeah/issues/573)
PR merges into develop. This is a policy specification with executable contract
examples; it does not install authentication or authorize current tool calls.

An architecture decision record (ADR) records a choice and the evidence required
to implement it. This record belongs to the independently extractable employee
contracts package. It applies to all specialist employees, compatible external
employees and the optional Chief of Staff. No coordinator or cloud service is
required to enforce the same policy locally.

## Decision and professional workflow

A human owns the employee's work and grants its limits. The employee can read
permitted evidence, calculate, draft and request review within that authority.
The human inspects the actual inputs, assumptions, findings and proposed action,
then approves, rejects or requests changes. The executing backend checks the
decision before carrying out the action. Approval of an interpretation alone
does not authorize saving it elsewhere, sharing restricted evidence, exporting
it or making an external commitment.

Separate five concepts:

| Concept | Meaning | Trusted owner |
| --- | --- | --- |
| Identity | Who is making this request, and for which customer | Verified transport adapter or restricted local launcher |
| Authority | Which operations and resources that principal may use now | Operator-controlled, versioned policy |
| Consent | Permitted purpose, source use and destinations, including revocation | Human/operator and applicable source policy |
| Human review | Decision about an exact work product, evidence and proposed operation | Authenticated, enrolled reviewer |
| Execution grant | Backend record permitting one bound operation under current policy | Trusted review/execution service |

An agent may propose an operation; it cannot create any of these permissions by
writing prose, supplying scopes, setting `approved: true`, declaring a Roman
persona or presenting a structurally valid contract. A good eval score also does
not grant authority. Models, prompts, retrieved documents and tool results are
untrusted inputs to this decision.

This is a shared contract/process slice. It changes no employee operating mode.
The Stand-alone Agent with Progressive Disclosure (Skills), Hierarchical,
Graph-Based Workflow, Ambient and Capability-First choices remain per role in
[ADR 0001](../../docs/adr/0001-durable-employee-contracts.md#operating-mode-selection).
An explicit review state machine is required of the future review adapter; its
framework implementation is not a mandatory business-contract dependency.

## Identity provenance and trust modes

Trust mode is operator configuration, never a request or model-selected option.
Unknown or absent configuration fails before protected operations.

| Mode | Required boundary | Limits |
| --- | --- | --- |
| Restricted trusted local | Explicit launch configuration supplies an operator principal, customer, employee grants, approved workspace and source/secret policy; OS/process permissions protect them | Single operator-owned process or equivalently isolated container; no anonymous/shared endpoint; source rights, audit and protected-action review still apply |
| Authenticated remote | Every request has identity verified by the configured adapter, current scopes and customer/resource membership | HTTP and other network entry points cannot inherit the local exception; an invalid identity is rejected before handler dispatch |

STDIO (standard input/output) is a local process transport, not proof that the
launched binary or its arguments are trustworthy. Approve installed code and
startup configuration; bound its OS access and inject only its allowed secrets.
Local HTTP requires explicit restricted bind/host/origin/access controls or the
authenticated remote profile. Setting a port must not silently expose local
authority on all interfaces.

For an OAuth-based MCP (Model Context Protocol) HTTP adapter, use the supported
MCP authorization profile and maintained authentication libraries. Validate each
token's issuer, intended resource/audience, validity, expiry and permitted scopes;
reject invalid/missing credentials with 401 and authenticated insufficient access
with 403. Server-side policy determines customer/employee membership and resource
rights; client-provided identity fields cannot override it. Protected-resource
discovery and authorization-server validation belong to the adapter, not a new
custom IAM (identity and access management) server in this package.
[MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)

MCP authorization differs between HTTP and STDIO. A supported protocol profile
must be selected and tested explicitly; this policy does not claim that the
current initialized SDK transport supports the newest protocol. BYO-agent and
protocol conformance are the [composition issue](https://github.com/ryemyster/ShaleYeah/issues/572).
Other authenticated transports must preserve the same verified-principal and
executing-boundary checks without claiming OAuth conformance they have not tested.

MCP session IDs provide transport correlation only. They cannot authenticate a
principal, select another employee's context or replace an execution grant.
Bind any supported session to verified identity and check each inbound request.
Never pass an incoming MCP bearer token to an unrelated downstream service;
obtain separate least-privilege connector credentials for the intended resource.
[MCP security guidance](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices)

An external employee is enrolled against its own stable employee ID, role,
capabilities and human owner. Its model-provider key is separate from access to
operator data and human review. The Chief of Staff receives only delegated task
authority and permitted outputs; delegation is an intersection of grants, never
an increase or automatic access to child employees' private context/credentials.

## Protected operations and executing boundaries

The backend that performs the operation owns enforcement, including when called
directly by a generic MCP client. Agent-side confirmation is an additional user
interaction, not the sole gate. Check read authority and source rights too;
read-only does not mean public.

| Operation | Autonomous limit | Required protected boundary |
| --- | --- | --- |
| Read/calculate/draft | Approved sources, workspace, budgets and purpose; output remains unreviewed | Connector/source access checks before acquisition and context assembly |
| Save a finding or accepted artifact revision | Prepare a candidate or request review | Authorized save policy, exact content/revision binding and human review where policy requires it; a draft save never changes review status |
| Promote private work to shared knowledge | Propose a handoff | Authenticated exact-revision review, receiving scope/source-use rights and retention checks |
| Export evidence/work | Prepare a permitted preview | Authorized recipient/destination, source export rights, redaction and required human review |
| External write, destructive or consequential action | Explain/request the proposed action | Explicit operation-specific policy and human approval; no implicit authority to commit capital, certify reserves or make legal decisions |

Policy must classify every operation; an unclassified operation is denied. A
backend cannot treat a `query` annotation, a prompt or a frontend-only button as
its security control. Permission checks precede side effects, including file
writes, shared-memory promotion, external requests and secret lookup.

## Exact binding and human decisions

The trusted review service obtains immutable source/product snapshots and
computes binding information. It must not trust hashes or revision claims from
the caller without verifying them against the actual bytes being reviewed/used.
Keep the canonical contract revision distinct from a particular artifact revision.

A grant binds all relevant values:

- verified requester/delegate and authorized reviewer, customer, asset, task and
  employee; task revision and exact review-request/decision IDs and revisions;
- work-product ID, revision, location and digest of immutable product content;
  input/source IDs, revisions, actual content digests and permitted access/use;
- the reviewed assumption set and relevant context/evaluation revisions where
  they influenced the decision;
- operation name, validated arguments, resource target, export recipient or
  external destination, approved limits and permitted purpose;
- current authority, reviewer, consent and source-policy IDs/versions, grant
  expiry/revocation state, idempotency key and durable audit reference.

Use SHA-256 content digests and a declared, versioned serialization for structured
arguments/binding snapshots. Review and execution must hash the same immutable
bytes or a tested canonical representation; unspecified JSON ordering is not a
portable hash protocol. Hashes detect differences, not identity or permission.
The implementing adapter records and tests its serialization/version before
interoperation; no custom signing protocol is introduced by this specification.

The human sees the evidence, assumptions, uncertainty/blockers, concrete action
and destination. Authentication alone is insufficient: current trusted policy
must enroll that reviewer for this operation and scope. Editing reviewed content
creates a new revision and a fresh review request.

| Decision | Result |
| --- | --- |
| `approve` | Trusted service may create one bound grant if reviewer, sources and operation are permitted; execution revalidates it |
| `reject` | No grant; preserve the reason and revision-specific decision |
| `request_changes` | No grant; revised inputs/assumptions/work require a new request and decision |

An approval cannot be carried forward after any material binding change, expired
grant, revoked permission, conflicting evidence or changed assumption. Require
fresh review rather than silently copying `approved`. Unknown identity, rights,
hash verification, policy state or decision provenance fails closed. Missing
professional inputs are surfaced as blockers; they are not invented to pass.

This is a project policy choice based on server-side, operation-specific
authorization with a final execution gate and invalidation after transaction
data changes. [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)

## Replay, concurrency, restart and audit failure

Store pending review, immutable snapshots, grants and outcomes in trusted durable
state. A small local transactional store can implement it; neither an in-memory
map nor an ADK confirmation flag establishes restart-safe authorization.

At execution, recheck identity, current policy/rights, expiry and every binding.
Atomically compare the current revision, reserve/consume the grant and persist a
redacted prepared audit record plus operation/idempotency identity before effects.
Concurrent callers cannot both acquire the same operation. For local storage,
commit the write and its outcome consistently; the implementation tests its
transaction boundary rather than promising atomicity across unrelated services.

An exact retry of a completed operation returns its recorded result without a
second effect. Reusing a grant/key with changed arguments or target is denied.
A still-pending operation is reconciled or awaited, not automatically executed
again. An external service's idempotency capability must be tested; without it,
reconcile uncertain outcomes through the authorized operator/connector before
retrying. Do not claim universal exactly-once execution.

Protected operations require durable audit preparation. If the sink/store fails
before an effect, return a visible audit-unavailable failure and perform no
effect. If an effect may have happened but outcome persistence fails, report
`uncertain` for reconciliation, retain prepared state and block blind reexecution.
Restart recovery revalidates grants, rights and revisions and uses these durable
records; restoring a backup must not revive consumed/revoked grants or deleted
sources. Follow the tombstone/invalidation policy in
[ADR 0002](0002-context-lifecycle.md).

An explicitly classified low-risk read may continue under a trusted policy with
a bounded durable local audit buffer when a remote sink is unavailable. This is
not permission to silently discard security events or disable protected-action
logging. Flush with stable event IDs and visible delivery failures; a full or
failed buffer stops operations requiring that audit policy.

Audit records identify time, correlation, verified principal, scoped task/
employee, policy versions, operation/target reference, review/grant reference,
decision/outcome and stable reason code. Log successful, denied and failed
operations, including direct-tool and early-denial paths. Exclude raw bearer
tokens, credentials, unrestricted argument/content dumps and sensitive errors.
Allowlist and redact fields **before** any log/audit/export emission; bound and
sanitize strings. Unknown unsafe content blocks its export and produces a safe
failure event. Key-name matching alone cannot redact secrets inside free text.
[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Credentials, source rights, files and destinations

Resolve secret references only inside the authorized executing adapter. A
reference is not a credential or an access grant. Scope injection to the one
employee/tool/connector, avoid inherited all-fleet credentials, and isolate
process environments where required. Do not place resolved secrets in prompts,
products, context/memory, model responses, review previews or logs. Redact at
each output boundary; rotate/revoke compromised references through trusted
operator policy. BYO model keys cannot authorize operator-source access.

Analysis access, retention, promotion and export rights are separate. Check
source classification, license/usage policy, purpose and current requester/
recipient access before reading, assembling context, promoting or exporting.
Permission on a summary cannot override restrictions on its underlying sources.
Changed rights invalidate derived context and grants transitively under ADR 0002.

File adapters allow only configured roots, approved file types and bounded input,
decompressed content, parse time, response size and writes. Reject traversal,
unapproved absolute paths, symlinks/root changes and special files where unsafe.
Validate the actual opened resource and race-safe containment, not just string
prefixes or an earlier path check. No arbitrary shell commands from model text.

Outbound adapters allow only approved schemes, hosts, ports, targets and resolved
networks. For untrusted URLs, block loopback/private/link-local/metadata and other
nonpublic addresses in both IPv4 and IPv6. Explicit operator-supplied internal
connectors may use narrowly declared internal networks for that connector;
model-selected URLs cannot invoke that exception. Resolve and validate all
addresses, connect only to validated destinations while preserving TLS hostname
verification, and reapply policy to redirects, retries and fallback connections.
Use network policy/egress proxies where available. A hostname allowlist alone
does not prevent DNS rebinding between check and connection.
[OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

## Contract examples, compatibility and proof limits

[authority-review.json](../fixtures/authority-review.json) references synthetic
records in [records.json](../fixtures/records.json), plus a request/decision that
explicitly describe saving the finding to its proposed target. The Geologist
review/input/operation control snapshot contains **32 executed validator cases** and
**28 future runtime acceptance scenarios**. Both languages run the same cases
and verify the actual scope/task/product/source/assumption/request/decision/
reviewer/audit reference chain and the action/target shown in the review request.
These reference comparisons do not validate an actual execution grant.
Hash values are synthetic declared values, not
fetched or authenticated evidence.

Executable cases demonstrate existing charter capability/policy comparisons and
current scope/task/product expectations, wrong-scope/revision rejection, required
review fields and forbidden boolean/enum additions. They also demonstrate limits:
a spoofed reviewer, changed declared source hash, nonexistent audit reference or
secret in free text can still be structurally valid. Passing validation is not
passing authentication, source verification, redaction or execution authorization.
Reject/request-changes records are valid records and confer no grant.

Runtime scenarios cover the allowed control plus identity/scope/model/direct-MCP
bypass, stale bindings/revocation, replay, audit failure/uncertainty, source-use
restrictions, secrets, workspace/size/egress/DNS checks, restart and BYO escalation.
Their expected outcomes are requirements for the owners below; these tests do
not execute those future services or certify their security.

All six canonical records remain at 0.1.0. Reference control/operation fields are
fixture protocol examples, not additional canonical fields or a supported grant
wire format. Trusted adapters maintain immutable binding/grant state linked by
the existing review references. If interoperable new business fields are needed,
publish a reviewed new schema version using the package compatibility rules;
do not smuggle fields into closed 0.1.0 records or treat metadata as authority.

## Current gaps, implementation owners and deletion

Current evidence was verified locally on develop `c56c750444cd067db3b5367e661282e68db2a7c2`.
The following behavior is not approved remote/protected-action enforcement:

| Verified path | Gap | Implementation owner |
| --- | --- | --- |
| `sdk/src/runtime.ts`: `execute`, `approvalChallengeFor` | Optional supplied scopes skip enforcement when absent; caller boolean bypasses approval; identity is supplied data | HTTP authority #678; exact review/execution #673 |
| `sdk/src/runtime.ts`: early `audit` calls and audit sink | Some early paths pass raw arguments; sink errors are swallowed; key-based redaction does not cover arbitrary text | Events/redaction #574; protected execution #673 |
| `sdk/src/mcp-server.ts`: HTTP callback, `registerTool`, `registerResource` | Requests/handlers have no authenticated resource/operation gate | Sessions #668; entry authority #678 |
| Geologist ADK finding confirmation | Confirmation alone does not bind durable authenticated review to exact inputs and operation | Review/resume #673 |

Connector/source/workspace/egress enforcement is #670; reusable client destination
controls are #679; provider/credential configuration is #669; context rights and
promotion are #672. Composition #572 and qualification #577/#674 test these
boundaries before a supported release. Each owner must execute the applicable
positive and negative scenarios, including direct backend invocation, with
side-effect counters and restart/concurrency tests where relevant. CI fixtures
need no external credentials; optional live claims require separate evidence.

This policy artifact replaces pending design statements, not active runtimes.
Do not delete still-used callers solely because this ADR exists. Inventory #576,
remaining role migrations and final cleanup #692 own replacement/removal. No
new IAM framework, custom crypto, mandatory database/provider/warehouse, cloud
deployment or fleet rewrite is introduced here. No existing enforcement gap is
advertised as fixed until its owning integration tests pass.
