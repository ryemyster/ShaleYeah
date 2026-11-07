# Employee runtime helpers

This Python package provides reusable state, provider and native ADK adapters for
independent SHALE YEAH employees. It imports no employee brain or matching tool
server. Each role supplies its own agent factory, source/review authority,
credential resolver and MCP endpoint.

The declared MCP client 0.3.0 pins the stateless 2026-07-28 profile. Connection
changes preserve scoped employee context and exact human-review records;
transport metadata or interrupted tool calls cannot create approval.

`context.ContextCatalog` stores private scoped tasks, evidence, drafts and pending
review references. Current authority is checked before reading or writing;
restoration preserves retention and cannot resurrect newly denied source data.
Changed checkpoints bind their previous revision so completing a review can
return to the same task state without reactivating an older record. Repeating
the current state is idempotent and still requires current write authority.

Shared dependencies are checked once per authorization phase. Each distinct
record-to-source binding still calls the current source authority. After token
counting, at model/history delivery and across writes, content checks, review,
restart and export, a new phase performs fresh checks. No source permission
receipt is cached across these boundaries. Before a phase finishes, the helper
rechecks local revisions, deletion, expiry and body integrity so changes during
an asynchronous source check cannot hide behind a previously visited record.

Exports keep the captured task, raw checkpoint and selected record metadata
bound through the final authority callback. If a checkpoint expires, changes,
is deleted or becomes corrupt during that wait, its raw content is denied.
The final local checks run after the last awaited grant. A checkpoint already
marked invalid retains only its permitted reference projection, with questions
removed. Restoring a valid export cannot extend its declared retention.

For `V` reachable records, `E` dependency edges and `B` record-to-source bindings,
one phase takes `O(V + E + B)` traversal work and at most `B` source checks.
Assembly uses two phases, before and after token counting; dispatch/history use
one. Selection records use a fresh dispatch phase and a write phase. Export
checks its snapshot and selected records and obtains source retention receipts,
for at most three binding passes. An installed content guard adds a fresh write
phase after that callback. These limits preserve every source and permission
boundary; they do not change financial or professional evaluation standards.

The seven-source regression uses four shared work layers, with two records per
layer (15 source/work records in total). Public API source-call counts are:

| Operation | Before phase traversal | With phase traversal |
| --- | ---: | ---: |
| Assemble, including the check after token counting | 2,324 | 126 |
| Authorize model dispatch | 1,162 | 63 |
| Record the selected context | 1,897 | 126 |
| Export permitted context | 1,960 | 189 |

These are deterministic authority-call counts, not model quality or HTTP timing
measurements. The owning tests also compare parallel chains and a deeper chain,
retain all seven sources, and test revocation and record changes between phases.

`models` contains the qualified configurable Gemini/Anthropic native adapters.
`events.EmployeeEvents` emits correlated metadata with exact record bindings.
`native.EmployeeRuntime` uses ADK's runner and durable session service.

An ADK role factory must disable implicit old conversation contents and bind
the supplied context selection, tool capture and sealed dispatch callbacks.
The runtime rejects incomplete factories before model dispatch. The host owns
the role, endpoint, identity and policy; model text cannot change them. Each
employee scans its own credentials and rejects configured credential references.
Remote tool/judge keys stay with their respective actors.

## Install and test

From this directory in the authoring workspace:

```sh
uv sync --locked --extra adk
uv run --locked --extra adk ruff check .
uv run --locked --extra adk pytest -q
uv build --wheel
```

The `adk` extra selects the pinned native runtime/provider dependencies. Import
the context helper without that extra when no native agent adapter is needed.
For independent installation, install this wheel with its declared first-party
contract, MCP-client and evaluation wheels. Authoring `tool.uv.sources` paths
are conveniences; installed wheels do not use those paths.

The library does not create approvals, select a model, provision a cloud target,
publish a report or promote unreviewed output. Current rights, reviewed sharing
and protected actions require trusted executing adapters. Fixture/native
regressions prove technical boundaries; professional output acceptance remains
with each role's evaluation and human workflow.
