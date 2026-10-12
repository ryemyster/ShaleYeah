# Retain a Geologist's working context

A Geologist can stop and resume the same task with its input references,
assumptions, unresolved questions and pending review references intact. The host
uses `ContextCatalog` for those records and `GeologistRuntime` for the native
ADK (Agent Development Kit) runner. SQLite stores the data on a local disk.
No warehouse, vector database or coordinator is required.

The employee remains **Stand-alone Agent with Progressive Disclosure (Skills)**.
Saving an interpretation and promoting shared knowledge require their own human
and backend authority. Retaining a private draft does not approve it.

## Two kinds of retained state

| Store | Contents | Reuse rule |
| --- | --- | --- |
| `catalog.sqlite` | Canonical tasks, source metadata, private work products, reference-linked checkpoints and selection manifests | Current scope, source rights/revisions, dependencies and retention must pass |
| `sessions.sqlite` | Native ADK events and a small set of controlled state fields | Recheck catalog and the history's original references before loading conversation content |
| `deletions.sqlite` | Minimal scoped deletion markers | Keep this current when restoring an older export; deleted inputs and descendants cannot reappear |

Source bytes stay with the source/tool provider. The catalog stores the published
`SourceArtifact`, not a second copy of its file. Private work stays separate from
reviewed handoffs. Model replies remain private session history; they are not
automatically turned into reusable knowledge.

Native ADK uses `include_contents="none"` for this runtime: it carries the current
turn and tool results, while a callback adds newly assembled working context.
Past conversation text is not replayed into the model. The ordinary
`agents-cli run` development entrypoint still uses its in-memory session; selecting
a framework session URL alone does not install these business checks.

## Bind trusted host interfaces

An authenticated host supplies the principal, exact customer/asset/task/employee
scope, assignment, model profiles, current source authority and context policy.
IDs describe ownership; they do not authenticate a caller. Use a stable employee
service principal for its private workspace. Different principals have different
namespaces; approved cross-workspace sharing uses the reviewed handoff interface.

`ContextCatalog.open(...)` requires these async callbacks:

| Callback | Required receipt |
| --- | --- |
| `grant_provider(principal, scope, operation)` | Matching `subjectId`, `scope`, `policy` equal to `contextPolicy`, allowed `operations`, `revoked: false` and a future `expiresAt` |
| `source_authority(evidence, principal, scope, operation)` | Matching subject/scope, `allowed: true`, allowed operations, current exact evidence metadata and `retentionExpiresAt` |
| Optional `review_authority(artifact_ref, principal, recipient_scope)` | Authenticated, current origin task, review request, decision and exact final work product; explicit recipient scope, expiry, usage and retention policies |

Grant operations are `read`, `write`, `assemble`, `export`, `restore` and `delete`.
Source operations are `read` and `export`. The host must authenticate the actual
caller and resolve current policy/source state through bounded services. Supplied
model text, arbitrary JSON flags, a framework session ID and an index result
cannot implement those callbacks. Unavailable authority blocks use.

The review resolver must authenticate the human and verify the audit/current
sharing decision upstream. Its receipt includes `work`, `decision`, `request`,
`task`, `recipientScope`, `current: true`, `expiresAt`, `usagePolicy` and
`retentionPolicy`. The catalog checks exact record bindings and contributing
source rights again. Without that resolver, shared promotion fails closed.
Authenticated review submission and protected continuation belong to the next
review implementation; this interface does not create approvals.

An optional host `content_guard` can reject additional known secrets or restricted
content. The runtime checks its configured model and MCP credentials before
native event writes and token-count dispatch. It never saves credential profiles
as knowledge. Keep independent judge credentials outside the employee runtime.

```python
import json
from pathlib import Path

from app.context_runtime import GeologistRuntime
from app.model_provider import read_private_config
from app.working_context import ContextCatalog

policy = json.loads(Path("examples/context-policy.json").read_text())
# principal, scope, task, source, draft and the callbacks come from your
# authenticated host and source broker, outside the model's output.
catalog = await ContextCatalog.open(
    Path("/absolute/private/geologist-context"), scope, principal, policy,
    grant_provider=current_context_grant,
    source_authority=current_source_access,
    content_guard=reject_host_secrets,
)
await catalog.put_task(task)
await catalog.put_source(source)
await catalog.put_work(draft)
await catalog.checkpoint(
    work_refs=[draft["artifact"]], pending_review_refs=pending_reviews,
    questions=["Confirm the supplied matrix-density assumption"], conflicts=[],
)
runtime = await GeologistRuntime.open(
    catalog, read_private_config("/absolute/private/models.json"),
    backend_config=approved_mcp_configuration,
)
try:
    result = await runtime.run("Continue the checkpoint and prepare it for review")
    # result.status reports context readiness or blocking, not professional acceptance.
finally:
    await runtime.close()  # also closes the owned catalog
```

This is an embedding example: implement the host's named interfaces before
running it. It intentionally contains no credential or self-issued sample grant.
Run the no-key native/SQLite controls below to test the supplied implementation.
For restart, reopen the same private directory, scope and principal, and use the
current callbacks and configuration.

## Configure selection and limits

[context-policy.json](../examples/context-policy.json) is data-only configuration.
Its age and retention numbers are demonstration values, not geological standards.
Choose source age by the actual data's meaning and your reviewed policy.

| Setting | Meaning |
| --- | --- |
| `contextPolicy`, `retention.policy` | Explicit policy IDs/versions; update them when policy changes |
| `budget.maxItems` | Maximum selected source/working/shared items |
| `budget.maxBytes` | Actual serialized UTF-8 invocation bytes, including instructions, tool definitions and context headers |
| `budget.maxTokens` | Selected model's counted input plus `reservedTokens`; keep within that model's documented window |
| `reservedTokens` | Include at least the configured output allowance and an appropriate safety margin |
| `maxCountCalls` | Cap count requests across one native invocation, including trimming retries |
| `maxRecords`, `maxRecordBytes` | Bound retained catalog versions, native event count and individual record size |
| `maxSourceAgeSeconds` | Source as-of age allowed by this role/task policy |
| `retention.seconds` | Local serving lifetime; expiry blocks access and authorized purge removes content |
| `ranking` | Installed lexical profile/version; changing executable ranking needs code qualification |

Required task inputs and checkpoint work come first. Optional eligible records
are ranked deterministically by lexical relevance, then source date, ID and
revision. Each excluded item has a reason without its denied text. A required
set that cannot fit returns a blocker and makes no generation request. The
manifest maps the local `context_limit` reason to the published
`unsupported_capability` blocker; it never silently drops the failure.

Pinned native Gemini and Anthropic adapters count the same prompt/system/tool
input used for generation. Gemini uses the documented full
[`generateContentRequest` token-count form](https://ai.google.dev/api/tokens)
because genai 2.11.0's ordinary configuration rejects system/tools in Developer
API mode. Anthropic reuses ADK's message/tool translation and its
[token-count API](https://platform.claude.com/docs/en/build-with-claude/token-counting).
Counts can differ from eventual usage, so configure a reserve. Missing/invalid
counts block; character or byte length is not reported as a model token count.
Serialization helpers are isolated, version-qualified adapter code. Dependency
upgrades must rerun count/generation parity controls.

`compact()` produces a bounded, structured projection with the original references,
units, assumptions and pending/conflicting work. It does not invent an LLM
summary or assert a model token count. `assemble()` qualifies the actual invocation.
Required work that cannot fit must be narrowed explicitly.

## Revisions, recovery and deletion

Record content cannot overwrite the same revision. Updates use compare-and-swap
against the observed head. Source byte identity remains the published SHA-256
artifact reference. A separate private metadata revision binds source policy,
scope, parser and usage metadata. Re-fetching only changes a receipt timestamp,
so it retains the first receipt; changing metadata creates a new revision and
invalidates dependent work even if the source bytes are identical.

Rights, source revisions, freshness and dependencies are checked before records
are materialized and again after counting and at dispatch. A revoked/superseded
input invalidates its derived work and checkpoint questions. Minimal reference
and pending-review metadata survives; an old summary cannot restore the input.
Private native history also checks its original metadata revisions before text
is loaded. After rebuilding valid work/checkpoints, authorized `reset_history()`
can discard obsolete conversation history while retaining the catalog.

`export_state()` returns the scoped current task/checkpoint and eligible records
under source export rights. It includes a compatibility version, retention policy
and original expiry. `restore_state()` rechecks rights and records, preserves
current newer versions, respects deletion markers and never renews the export's
retention lifetime. A restore can omit unavailable/deleted dependencies; subsequent
assembly reports required missing inputs. Re-opened reviewed handoffs require a
current review resolver, not their stored approval flag.

Use `runtime.delete(ref)` to purge native conversation history and the catalog's
matching content/descendants. `runtime.purge_expired()` performs authorized
expiry cleanup; call it from the trusted host's retention process. Expired
content is never served while awaiting that cleanup. Minimal references and
deletion markers remain for permitted audit/replay prevention. Source-level
deletion applies to all versions of that source ID in this private task scope.
Global source revocation is the upstream broker's responsibility.

Keep current deletion markers during recovery. Restore business exports through
the API; copying an older raw database over current files is unsupported. Raw
native ADK history backups are not portable context exports or approval records.
ADK's native schema is qualified separately from the stable business schemas.

The private directory requires mode 0700 and regular owned files require 0600.
Symlinks and multiply linked files are rejected. The runtime holds a per-workspace
writer lock; a second writer is rejected. This local reference supports a small
corpus and one active native writer. Multi-replica storage, Windows and hosted
deployment require their own qualification. Use the locked SQLAlchemy asyncio
dependency; [SQLAlchemy 2.1](https://docs.sqlalchemy.org/en/21/orm/extensions/asyncio.html)
requires the asyncio extra for `greenlet`.

## Verify locally

From `agents/geologist`:

```sh
uv run --frozen pytest -q tests/test_working_context.py \
  tests/test_context_runtime.py tests/test_context_token_count.py
uv run --frozen pytest -q --cov=app --cov-fail-under=90
```

These run real native ADK/SQLite and native SDK request translation against
explicit offline HTTP fixtures. They cover restart, scope, metadata changes,
stale/transitive summaries, conflicts, byte/token limits, current review bindings,
export/expiry/deletion and mutation after counting. Fixture token responses do
not measure live provider counts or professional model performance.

From the repository root, run installed wheels outside the checkout:

```sh
uv run --project agents/geologist --locked bash sdk/python/scripts/check-isolation.sh
```

No professional geology approval, complete container journey or protected
review/resume is certified by these controls. The source benchmark and final
human workflow acceptance remain separate parts of the product plan.

The implementation studied Google's pinned
[cross-session-memory recipe](https://github.com/google/adk-samples/tree/d079ffce2046e22641eb3110cab52c8e976d038f/core/python/cross-session-memory)
and [long-horizon context budget](https://github.com/google/adk-samples/blob/d079ffce2046e22641eb3110cab52c8e976d038f/core/python/long-horizon-harness/docs/context-budget.md).
It reuses native callback/service boundaries and reference-aware budgeting;
automatic transcript promotion and hosted Memory Bank are not part of this local
implementation. Business lifecycle rules follow the packaged
[context ADR](../../../contracts/docs/0002-context-lifecycle.md).
