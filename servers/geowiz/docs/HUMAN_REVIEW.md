# Review and resume a Geologist finding

The employee can prepare a geological draft. An enrolled human inspects the
actual evidence, assumptions, reported evaluation failures and proposed save.
Geowiz then permits only that exact private save. This does not certify geology,
publish shared knowledge, export data or commit capital.

The primary employee mode is **Stand-alone Agent with Progressive Disclosure
(Skills)**. Review is a deterministic business-state adapter around ADK, rather
than another reasoning agent. SQLite holds immutable packets, decisions,
grants, finding bodies, checkpoints and audit. No cloud service is required.

## Configure the operator boundary

Build Geowiz and complete [source setup](DATA_SOURCES.md) and
[MCP HTTP access](HTTP_ACCESS.md). Use Node >=22.13 with `node:sqlite` enabled.
Node 22 labels that API experimental; CI qualifies the selected Node 22 runtime.
Keep this database in a dedicated operator-owned directory with mode 0700;
configuration, credentials and files must be owned regular files with mode 0600.
The adapter rejects unsafe directory/file ownership, symlinks and hardlinks.
Use persistent local storage with SQLite locking and fsync semantics.

Create a private JSON review configuration outside the repository:

| Field | Value to supply |
| --- | --- |
| `directory` | Absolute private persistent directory for `review.sqlite` |
| `sourceConfigFile`, `sourceAuditFile` | Owned source configuration and durable private audit destination |
| `policy` | The operator-controlled policy described below |
| `localReviewer` | `{ "uid": <your OS user ID>, "subjectId": <enrolled human ID> }` |
| `sensitiveFiles` | Absolute private files for **every** credential available to this employee/backend, including the MCP credential and selected model keys |

The local CLI derives the human from this owned configuration and the current
OS user ID, never from model arguments. It is a single trusted operator setup,
not isolation from hostile programs running as that same OS user. The employee
gets MCP tools without a shell, configuration access or a decision endpoint.
Remote hosts must authenticate/enroll the human independently before invoking
the portable review API; this package does not supply a remote identity service.

The policy is data, so operators can change these limits without editing code:

| Policy field | Meaning |
| --- | --- |
| `version` | `0.1.0`, the adapter configuration version |
| `qualification` | `fixture` (default) or `live`; operational event provenance, not professional quality |
| `id`, `revision` | Policy identity/version; changing policy invalidates prior packets |
| `task` | Actual canonical 0.1.0 TaskAssignment, including current source-byte ArtifactRefs and exact customer/asset/task/employee scope |
| `requester` | Bound employee subject/customer/employee/scopes from the trusted transport configuration; include `geowiz:review`, `geowiz:save` and required source scopes |
| `reviewerIds` | Enrolled human subject IDs; cannot include the employee requester |
| `operation`, `destination` | `save_finding`, `private-reviewed-findings` only |
| `expiresAt`, `revoked` | Current operator authority deadline and revocation |
| `grantTtlSeconds` | 1–86400; packet/grant expires earlier if policy/context does |
| `contextPolicy`, `retentionPolicy` | Exact `{id, version}` matching the reviewed context manifest |
| `allowedUsagePolicies` | Explicit source-use policy versions permitting this scoped private review and retention; read access alone is insufficient |
| `requiredGates` | Any of `no-blockers`, `evidence-present`, `eval-present`; all selected gates must pass before approval |
| `maxPacketBytes`, `maxRecords` | Packet limit 1024–8000000 bytes, store limit 1–10000 immutable requests |

The task's inputs must match the fetched canonical source ArtifactRefs, not
manually invented hashes. The connector verifies current grants and actual
bytes at preparation, human inspection/decision, status and execution. This
reference accepts source-backed LAS/CSV inputs; it declines unverified working
artifacts/shared context. Select versions granting this specific private
retention and configure expiry within source retention rights. The caller
cannot add destinations or approve licensed export through metadata.

Add `reviewConfigFile` to the private local HTTP configuration. Grant ingress
scopes for `prepare_review`, `get_review_status` and `save_finding`. Restart the
launcher. Unconfigured review fails closed even when ingress permits a save.
Current review/source policy files are reread for every operation; changing
storage or connector binding requires a deliberate restart.

## Prepare, inspect and decide

The agent's `prepare_geowiz_review(candidate_json, expected_head)` submits an
exact candidate with `work`, `context`, `evaluations` and `finding`. Work and
context use the shared canonical contracts. The work must be `ready_for_review`
and `unreviewed`; input refs/evidence must match the operator's task and actual
sources. Evaluation entries contain `id`, `revision`, `result` and `failures`.
They are **reported evidence**, not an authenticated score or authority grant.
The human must inspect their limitations; passing a score cannot approve work.

The proposed finding contains bounded `findingType`, `title`, `summary`,
`confidence`, `dataSource` (evidence ID) and optional structured `metadata`.
Confidence is a declared assessment. This interface does not calibrate it.
The full proposed arguments and destination appear in the human packet.

`expected_head` is null for the first request, then the previous `packetDigest`.
Changed content requires a new work revision. The backend compares the head
atomically, prevents rewriting an existing artifact ID/revision and supersedes
older unfinished requests. It computes a digest of sorted-key finite JSON
(`geowiz-review-0.1.0`), preserving array order. Review and execution use those
same server-owned bytes; a caller's claimed digest is not accepted as proof.

Preparation returns a reference-only checkpoint, including `reviewId`,
`packetDigest`, state and expiry. It writes no accepted finding. The human runs
these commands from `servers/geowiz`; secrets are referenced by file paths:

```bash
GEOWIZ_REVIEW_CONFIG_FILE=/absolute/private/review.json \
  node examples/review.mjs inspect REVIEW_ID /absolute/private/new-packet.json
```

This creates a new private file and refuses to overwrite an existing file.
Inspect its task/inputs, source text/provenance, draft findings/assumptions,
uncertainty/blockers, context/evaluation versions, concrete action and expiry.
Keep the packet private and delete the preview within the same retention window.
Write a nonsecret review reason in an owned mode-0600 file, then decide:

```bash
GEOWIZ_REVIEW_CONFIG_FILE=/absolute/private/review.json \
  node examples/review.mjs decide REVIEW_ID PACKET_DIGEST approve /absolute/private/reason.txt
```

Use `request_changes` or `reject` in place of `approve` when appropriate. Only
approval produces a grant. Inspection and decision are deliberately absent
from the employee's MCP tool inventory. The CLI prints references/state only,
never source content, credentials, the reason or the grant.

Optionally append an owned private JSON measurement file to `decide` containing
`humanReviewSeconds` (0–86400) and/or integer `corrections` (0–1000000). These
are reported by the enrolled human, not estimated from waiting time. Zero stays
zero; absent measurements stay absent. The backend adds `reworkCount` from the
number of prepared revisions in this scoped task. Its transaction stores a
validated, redacted canonical employee review event alongside the decision;
operator audit paging can export that event to the existing event consumer.
No measurement can grant authority or certify model/domain accuracy.

## Resume and recover

The trusted Python host can use `app.review_supervision.ReviewSupervisor` with
its `MCPClientConfig`. `checkpoint(review_id)` reads durable backend state;
omitting the ID recovers the current task's checkpoint after a lost response.
`resume(review_id)` returns pending/rejected/changes-requested state or executes
one approved save. It does not call a model or treat a confirmation as authority.
The normal ADK `save_geowiz_finding(review_id, packet_digest, grant_id)` keeps its
native confirmation UI and sends only these bound references to Geowiz.

The backend rechecks identity, current policy, reviewer enrollment, exact head,
sources/content and expiry. `save_finding` rejects inline content, boolean
approval, foreign/replayed grants and changed arguments. The SQLite transaction
commits audit preparation, finding, consumed/completed state and outcome together.
Concurrent exact retries return the same result. Interruption before commit
rolls all of them back; restart reads the durable checkpoint. This guarantee is
for this local SQLite save, not arbitrary external systems or replicas.

Native pinned ADK 2.4.0 SQLite pause/resume passes an offline restart control.
[ADK documentation](https://adk.dev/tools-custom/confirmation/#known-limitations)
still marks confirmation experimental and DatabaseSessionService unsupported.
Our durable business approval is independent of that observed UI behavior.
The original draft remains immutable: saving records its decision separately;
it does not overwrite its review metadata or promote it to shared context.

Expired content is inaccessible. Run the operator cleanup periodically:

```bash
GEOWIZ_REVIEW_CONFIG_FILE=/absolute/private/review.json node examples/review.mjs purge
```

Cleanup erases expired packets, decisions and saved bodies and vacuums SQLite;
minimal expiry/consumption/immutable-revision markers remain. Store capacity
counts those retained requests and stops new preparation when full. Audit is
metadata-only, required and bounded (100000 records by default); capacity or
storage failure blocks operations. Operator APIs can page audit at most 1000
records per call. Do not replace this database with an older backup: restoring
consumed grants or removed sources is unsupported and requires reconciliation
with current authority. Keep current state and connector audit together.

Tests cover real generic MCP plus the human CLI, scoped exact review, source
revocation, changed revisions, gate failures, expiry, restart/concurrency and
transaction rollback. They use offline transport fixtures and do not certify
field geology. The initial [LAS baseline](LAS_REVIEW.md) is research-reviewed;
contributors can improve it. Final human MVP/release acceptance remains separate.
