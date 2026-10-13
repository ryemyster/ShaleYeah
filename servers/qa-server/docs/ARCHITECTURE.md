# Architecture

The operating mode is **shared contract/process only**: deterministic QA tools
with an optional model note. There is no employee reasoning loop or coordinator
inside the server. It is independently buildable and extractable with declared
SDK and business-contract archives.

`server.ts` defines the MCP interface and bounds each request's time.
`QAService` checks the current authenticated principal, task, profile approval
and source rights. `QAInputs` resolves references through a host-owned authority,
checks exact scope/revision/URI/hash and scans source content. `decodeQAData`
validates supported records and maps defect locations to original source fields.
`evaluateQARules` executes the eight allowlisted rule types. `QAResultStore`
keeps private immutable SQLite artifacts; reports read those artifacts rather
than constructing a replacement assessment.

The pure evaluator grants no access. Its callers must verify source authority;
the public tools use `QAService`, which performs that verification. The service
rechecks task/profile/source bindings after awaited scanning/audit/model work.
Changes block stale reuse. A profile grant includes the SHA-256 of its parsed
JSON, so changing rules under an old approval is denied after restart too.

Work products use the existing closed 0.1.0 business envelope. Detailed domain
results are separate private artifacts. Findings are measured only when an
observed pass/fail has evidence; unresolved checks retain unknown basis and
explicit reasons. Observed-result review is always `unreviewed`. The data/producing owner owns
source repair, consequential waiver, final acceptance and publication outside
this tool surface. Model notes cannot execute those actions.

Storage uses a private owner directory and file, hashes its bodies, scopes refs
by customer/asset/task/employee, and preserves previous artifacts until expiry.
Original source-grant expiry caps result retention; extending a grant does not
extend an existing artifact. Expired records are removed on subsequent store
access. A stopped process cannot provide scheduled deletion; operators manage
backups and offline cleanup. The file/directory identity is checked on access.

MCP requests use the shared identity, scope, correlation, error and event
adapters. Host audit export is required. Logs contain metadata and hashes rather
than source rows or model prose. Private operator exports attest upstream rights;
a hosted deployment must inject its authenticated live authorities and verifier.
The operating system user who controls a local export controls its attestation.

`QADispositionWorkflow` adapts the installed exact human-review state machine
to a separate disposition work product. It re-reads the immutable QA report
and current disposition policy before preparation, decision and execution.
Changing a result, source/profile/task revision or policy invalidates the packet;
expired exceptions and exceptions over UNTESTED/ERROR are denied. A separately
enrolled human decision and packet-bound installed qualification are required.
An accepted exception retains the original FAIL and counts. Cancellation reaches
source reads and prevents a late packet transaction after timeout.
