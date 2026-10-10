# ADR 0002: Employee context and reviewed knowledge lifecycle

Status: accepted policy for implementation through #672/#673, 2026-10-08.
Owner: shared contracts unit; every employee and compatible coordinator consumes
the same ownership rules. This specification is shipped with `contracts/` so it
can be extracted with its schemas, examples and verification commands.

An employee keeps the material it needs for its current job. A geologist can
inspect a well log, prepare an interpretation, ask the human geologist to review
it and send an approved finding to another employee. Sending that finding does
not expose the geologist's entire conversation or private working notes.

This is a policy and reference-example decision. No storage/retrieval service,
authorization engine, ADK compactor or employee migration is implemented here.
The existing schema validators check structure and explicit caller comparisons.
Runtime enforcement and restart evidence belong to #672/#673/#573.

## Decision and ownership

Keep five kinds of state separate:

| State | Owner and intended use | Sharing rule |
| --- | --- | --- |
| Task state | Durable assignment, current task/product revisions, status and pending review/action references | Authorized task owner/delegate; coordinator receives permitted status/work products |
| Current model context | One bounded input assembled for one employee invocation | Temporary; no automatic shared-memory ingestion |
| Evidence store | Versioned source bytes and metadata, source rights and dependency references | Access broker checks the authenticated recipient against each contributing source |
| Private employee knowledge | Role instructions, working notes, draft interpretations and proposed summaries within declared scope | Exact customer/asset/task/employee ownership or explicit authenticated delegation |
| Reviewed shared knowledge | A current approved product/finding with provenance, decision and usage/retention references | Explicit permitted handoff or retrieval; never broad access to private context |

Customer, asset, task and employee IDs are identifiers, not credentials. An
authenticated principal is resolved by trusted code into a grant for the exact
requested scope and operations. Source/evidence rights are checked separately.
Being another employee in the same organization, an administrator in an agent
framework, or Chief of Staff does not imply access to every scope.

These defaults apply to all 14 roles and external compatible employees.
Role-specific inputs and review duties remain in the
[role matrix](../../docs/employee-role-matrix.md); deployment copies can use the
committed matrix/version link as reference documentation. Chief of Staff consumes
permitted outputs/status rather than another employee's complete memory. #675
specifies its authority. Each role keeps the operating-mode decision from ADR
0001; this shared contract/process slice selects no runtime execution mode.
Stand-alone skills, hierarchical delegation, graph gates, ambient triggers and
capability routing all obey the same rules.

Use the existing 0.1.0 `Scope`, `SourceEvidence`, `WorkProduct`,
`ContextManifest`, `ReviewRequest`, `ReviewDecision` and versioned references.
No new business wire schema or parallel Python/TypeScript model is introduced.
The trusted adapter catalog records eligibility, source access/revision and
dependency state that cannot be established from a supplied record alone.

Version 0.1.0 is the current published baseline, not a permanent freeze. Schema
evolution follows ADR 0001 and the package compatibility rules; runtime and
retrieval adapters qualify separately against the same business behavior.

## Lifecycle and human decisions

Retain original versions as history where rights/retention permit. Changing an
input, claim, scope or approval creates a new revision; it does not rewrite a
reviewed artifact or silently transfer its approval.

| Transition | Preconditions and result |
| --- | --- |
| Receive source → usable evidence | Authorized access/usage, content hash and source revision verified, as-of/freshness policy satisfied; incomplete/unavailable source yields a blocker |
| Evidence → private draft | Employee may inspect permitted inputs and draft claims/assumptions; results remain unreviewed |
| Draft → review proposal | Exact task/product/source/policy revisions, provenance, uncertainty and requested decision are recorded; missing required evidence remains blocked |
| Proposal → changes requested/rejected | Authorized human records reason and exact reviewed revision; no shared promotion follows; corrections create a new product revision |
| Proposal → approved work | Trusted code authenticates reviewer/grant and resolves the decision, task, request and product references; a declared approval flag is insufficient |
| Approved work → shared knowledge | Explicit approved sharing scope, inherited source usage/retention rights and current dependencies pass; commit checks revisions again atomically |
| Current knowledge → invalidated/superseded | Source/product/policy changes, access revocation, contradiction or corrected interpretation prevent trusted reuse; retain explainable history when permitted |
| Current/invalidated knowledge → expired/deleted | Retention or authorized deletion removes served content and affected derived material; minimal permitted audit/tombstone prevents resurrection |

These are policy transitions, not additional enums on `ContextManifest`.
Work-product/review statuses map to the existing schema. Trusted storage must
record why an item is eligible or excluded and its dependencies. Approved does
not mean correct forever, public, or permission for a protected action.

The human domain owner approves professional interpretations, material changes,
shared promotion and any binding/high-consequence action within granted authority.
An agent can assemble private context and propose a summary/handoff without
turning it into trusted shared knowledge. Source restrictions cannot be waived
by approving the product. #573 defines authenticated reviewers, scopes, audit
and replay protection; #673 implements revision-bound review and continuation.

Promotion uses a compare-and-swap check across current task/product/source/policy
revisions after review, immediately before commit. Concurrent changes invalidate
the proposal. Duplicate processing is idempotent for the same decision and
revision; a late/replayed approval cannot promote a new revision. A valid
external employee uses the same boundary.

## Deterministic retrieval and budgets

The policy is configured/versioned per role and customer. Declare required
input types, permitted scopes/classes, data-type freshness rules, relevance
profile, item/UTF-8-byte/token limits, prompt/output reserves, retention and
review rules. An ordinary policy adjustment is validated configuration;
executable ranking/metric changes require code review and parity/conformance
evidence. No universal freshness period or domain-confidence threshold is set
by this ADR.

Selection is deterministic for a fixed catalog, authenticated grant, policy,
query and clock:

1. Resolve trusted caller/task/employee ownership. Reject a mismatched scope or
   missing grant before exposing candidate text. Allow only explicit permitted
   handoffs outside private scope.
2. Check every candidate's contributing source access/usage, exact current
   revisions/hashes, retention, freshness and dependency state. Shared candidates
   additionally resolve current authenticated review. Fail closed on unavailable
   policy/catalog/review data; stale index results cannot bypass this step.
3. Materialize only eligible source content. A retrieval adapter must filter the
   permitted corpus before search and recheck current rights/revisions before
   using results. Provider snippets/embeddings/ranks confer no authority.
4. Reserve required task instructions, professional rules, required input
   references, uncertainty and pending review/action decisions. If this minimum
   cannot fit the model's usable input window after system/tool/output reserves,
   return a context-limit/missing-input blocker and request narrower work.
5. Rank optional candidates by configured task applicability and relevance.
   Baseline order: required references first, exact asset/input matches, same
   task, allowed same-asset handoffs, then allowed role knowledge. Within a tier,
   use the pinned lexical/scoring profile; tie-break by as-of descending, stable
   artifact ID ascending, then revision ascending. Date/revision comparisons are
   explicit; vendor score magnitudes are not interchangeable.
6. Render candidates with evidence/review/uncertainty headers. Count manifest
   items using the canonical selected-evidence + working-reference + shared-item
   rule; count the actual serialized UTF-8 bytes and model-specific tokens of
   the materialized invocation separately. Count all rendered headers/metadata
   and nested provenance, not just text bodies. Stop adding optional items when
   any limit would be exceeded; record exclusions without leaking denied content.
7. Emit a new bounded manifest with exact task/policy/source/artifact/review
   references and retention expiry. Recheck grant/dependencies immediately before
   use; reject/rebuild if changed. Persist the manifest/selection event IDs for
   reproducibility, not secret-bearing model prompts.

A missing required source is a visible blocker; a merely unavailable optional
candidate is an explained exclusion. Do not silently fill missing values with
zero, raise confidence, or convert unknown/assumed claims into measurements.
Unknown tokenizers/profiles must use a qualified conservative bound or block.
Byte limits alone do not establish a token budget. #672/#669 qualify adapters;
the 0.1.0 schema currently validates declared limits/item count, not actual
materialized bytes/tokens or caller permissions.

## Compaction, conflicts and invalidation

Compaction is a private derived representation for a specific scope. Keep
original authorized inputs outside the model window; a summary is never the
only evidence record. Its dependency catalog binds input IDs/revisions/hashes,
source rights, task/policy revision, summarizer/format version, units,
measured/assumed/unknown claims, uncertainty and pending decisions.

Use deterministic structured extraction where possible. An LLM summary is
untrusted draft material: validate preserved references/units/claim states and
compare with the source. Record missing or altered claims as drift; exclude the
summary and request correction/review. A domain human judges semantic correctness;
a configured LLM rubric may assist under #666/#667 but cannot grant permissions
or certify itself. Derived private summaries inherit all input restrictions;
shared summaries require the same authenticated promotion boundary as other
shared work products.

When current findings disagree, preserve their separate source/review identities
and expose the conflict to the domain owner. A newer timestamp or higher model
confidence alone does not resolve an interpretation disagreement. Deterministic
unit/revision reconciliation must be declared and traceable; unresolved required
conflicts block the affected conclusion.

Maintain a dependency graph from sources/products/decisions/policies to summaries,
shared knowledge, manifests and pending actions. Source replacement/deletion,
access revocation, expired retention, withdrawn review or product corrections
invalidate affected reuse, search/vector entries, cached manifests and approval
references. Invalidate descendants transitively; a summary cannot launder a
revoked source. Revalidation against the current catalog is required even if
an index update is asynchronous.

On restart, load durable task/revision/dependency/review state, resolve fresh
identity/grants and rebuild a manifest. A framework session ID, old model prompt
or previously stored `approved` flag cannot resume a protected action.
Record fresh denial/blockers rather than recovering stale content from an
unreviewed transcript.

## Storage, export and deletion

For the small-data reference, start with versioned files plus a durable catalog
(or a small local transactional store) at a configured location. Keep bytes,
metadata/review/dependency history and indexes separable. Require atomic revision
updates, conflict detection, locking for the supported worker count, recoverable
writes, restart checks, scoped permissions and backup/deletion tests. Plain
files in a writable directory do not provide those guarantees automatically.
#672 selects and verifies the actual storage implementation; this ADR installs
neither a database nor a new store.

Export is a protected scoped operation. Resolve recipient rights to every input,
strip secrets/denied content before serialization/logging, and retain permitted
source/revision/reviewer/policy references and correlation/audit IDs. If removing
restricted evidence would make a claim ungrounded, omit the claim or reject the
export. Secret values are resolved outside prompts/records; do not ingest them
as knowledge or include them in diagnostic text.

Deletion covers source bytes, private drafts, derived summaries/embeddings,
indexes, caches, exports under system control and permitted backup restoration.
Record a minimal protected tombstone/audit event without retaining forbidden
content. Legal/contractual holds and externally delivered copies need an explicit
operator policy and disclosed limits; do not promise irreversible deletion of
systems outside our control. Apply the current deletion/revocation ledger before
restored data can be served. #573/#574/#672/#673 own enforcement and evidence.

## Optional retrieval adapters and evaluation

The following is an architectural comparison, not a measured benchmark. Choose
the smallest qualified adapter that meets the operator's measured workload.

| Option | Useful candidate workload | Cost/access implications and adoption gate |
| --- | --- | --- |
| Scoped file/catalog lookup | Small corpus, exact well/source/artifact IDs, explicit handoffs | No hosted dependency; caller must implement authorization, durable updates and bounded scanning; reference baseline for #672 |
| Lexical search, optionally SQLite FTS5 | Exact domain terms, well IDs and local searchable text | Local index/update cost; FTS is not access control; preserve scope filters and qualify recall/latency on the same corpus |
| Vector or hybrid retrieval | Paraphrases/concept queries that the lexical baseline misses | Embedding/provider/storage cost and potential data disclosure; pin model/index/rank versions, deletion propagation and eligible-corpus filtering before adoption |
| Warehouse/hosted search, optionally Snowflake Cortex Search | Operator already hosts governed data or measured retrieval scale needs it | Additional compute/storage/serving costs and service-specific privileges; enforce employee/source rights independently and qualify freshness/revocation behavior |

SQLite FTS5 provides lexical search and a BM25 ranking function whose better
matches have lower numeric scores. Its rank must be normalized explicitly in
a profile if used alongside another scorer.
[SQLite FTS5 documentation](https://www.sqlite.org/fts5.html#the_bm25_function)

Snowflake documents hybrid keyword/vector retrieval, owner-rights search and
warehouse/embedding/serving/storage cost components. Search-service privileges
do not establish the employee's authorization to contributing evidence.
This is why small-data deployment does not require Snowflake or a vector service.
[Snowflake Cortex Search](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-overview)

Before changing adapters, evaluate one versioned, source-rights-aware corpus and
the same role tasks. Include exact identifiers, paraphrases, no-answer cases,
conflicting inputs, restricted records, changed/deleted sources and summaries.
Measure recall/precision of authorized current evidence, job-output completeness,
source/uncertainty preservation, stale/denied disclosure count, p50/p95 latency,
tokens/bytes, indexing/update cost and per-successful-task cost. Record corpus,
policy, query, clock, adapter/index/model and metric/judge versions.

Trust cases require zero unauthorized/stale served items in the qualification
pack; faster retrieval cannot compensate for leakage. Professional completeness
thresholds and quality/cost improvement targets require an operator/domain-owner
approved configuration, not invented scores. No representative operator corpus,
domain review or backend benchmark was run for this ADR. #672/#691/#693 and
role-adoption issues provide runtime/professional qualification.

## Framework mapping and reference evidence

ADK distinguishes conversation session/state from cross-session memory, and
in-memory services lose data on restart. Those are adapter concepts, not a
replacement for durable employee ownership/review/source policy.
[ADK session/state/memory](https://adk.dev/sessions/)

ADK memory services expose session ingestion/search and optional explicit
event/memory writes. Confirm the selected service's support; our adapter must
guard ingestion so unreviewed transcripts do not become trusted shared knowledge.
[ADK memory services](https://adk.dev/sessions/memory/)

ADK supports configured context compaction and custom model summarizers. Its
summarized session history still needs the provenance, scope and drift checks
above. A compactor is a replacement implementation choice, not a policy authority.
[ADK context compression](https://adk.dev/context/compaction/)

The synthetic [reference fixtures](../fixtures/context-lifecycle.json) include
six valid records, three structurally invalid records and sixteen expected
policy scenarios. They show Geologist → Research Analyst sharing, denied raw/
restricted promotion, revision/access/deletion invalidation, expiry, private
scope denial, summary drift/conflict, budget overflow, restart and export/deletion.
The fixture `trustedFacts` are simulated authoritative observations for future
tests, not validated credentials. `fixtureVersion` identifies the example
catalog; it is not a new employee wire-contract version.

Both language suites validate the record examples and approval/source binding.
The scenario outcomes specify #672/#673 behavior; this PR does not execute those
policy scenarios. The package README supplies build/test/isolation commands
without a framework/cloud/SDK dependency. Do not promote this policy completion
to a claim of implemented isolation, durable restart or professional acceptance.

Legacy `ContextStore` remains an in-process map with known callers, including
the four remaining TypeScript employees. Its namespace API is not authorization
and it stores synthesized output without authenticated promotion. The fixed
Supabase/vector Phase 2 promise is removed; #576/#692 and role migrations own
replacement/deletion after useful behavior is accepted.
