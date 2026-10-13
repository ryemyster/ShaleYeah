# Integration

An independent MCP client can call the server. Its authenticated identity must
match the customer's QA employee and approved subject, with `qa:read`,
`qa:run` and `qa:report` scopes as needed. HTTP hosts use the shared SDK access
adapter with a real bearer verifier, issuer/audience checks, explicit operation
scopes and required audit. A local principal is for private stdio operation;
it never substitutes for a missing HTTP identity.

Pin the MCP 2026-07-28 profile. The shared SDK 0.3.0 serves self-contained HTTP
requests and modern stdio messages; older initialization/session clients are
rejected. Discover current input/output schemas through the maintained client.
Result and task handles retain their own durable ownership and expiry.

For a private operator export, run the fixture generator in the README, then
read your owner-only `qa.json`. Build correlation metadata from its `correlation`,
`task.scope`, `task.revision` and `qualification` fields:

```json
{
  "org.shaleyeah/correlation": {
    "context": {
      "runId": "<configured runId>",
      "traceId": "<configured 32-character hex traceId>",
      "scope": "<the configured scope object>",
      "taskRevision": "r1",
      "qualification": "fixture"
    },
    "parentEventId": "client.qa.request",
    "spanId": "1234567890abcdef"
  }
}
```

Pass that object as MCP request `_meta`; substitute the actual scope object,
not the placeholder string. Correlation identifies a request, and grants no
permissions. Missing or mismatched correlation is blocked when a host binds events.

`run_quality_tests` accepts only:

```json
{"taskRef":{"id":"task.qa.fixture","revision":"r1"},"profileRef":{"id":"profile.qa.normalized","revision":"r1"}}
```

The successful MCP result is `structuredContent.analysis`, including
`resultRef`, the canonical `work`, and detailed `payload`. Call
`generate_quality_report` or `triage_quality_result` with
`{"resultRef": <that exact returned reference>}`. Text and structured content
carry the same serialized result. Tool failure sets `isError`; examine the
shared error classification. A `FAIL` or `UNTESTED` data verdict is a successful
execution of a check, with its status retained in the domain payload.

For live integrations, inject `QAInputs.current(id, principal)` to resolve exact
bytes, source metadata, projection and current scoped read/export grants. Inject
`QAService.current()` for the canonical task, approved profile and current grant.
Also supply a required audit sink and content guard. Connectors retain ownership
of raw format parsing; normalize only after their rights and parsing checks.
An internal artifact store can supply canonical work-product bytes through the
same hook. Supply `service`, an SDK `http.access` verifier/policy, and bound
`events` to `new QAServer(...)`. Host callbacks are trusted code, never tool args.

Each profile grant seals `profileHash = sha256(reviewJson(qaProfileSchema.parse(profile)))`.
The approval record must change with its profile content/revision. Tool callers
cannot pass new rules, grants, thresholds, approval flags, output paths or scripts.
Changing source content requires a new source revision/hash and task references;
the resulting artifact has a new immutable reference. Previous artifacts are
unchanged and cannot be exported under mismatched current authority.

The standalone extraction check installs its independent MCP consumer from an
explicit production dependency. It removes development packages and verifies
the consumer can still import the maintained client before container checks.
Test runners remain development dependencies. This qualifies the fixture
connection environment; it does not add a client dependency to the tool server
or replace its source and human-review boundaries.
