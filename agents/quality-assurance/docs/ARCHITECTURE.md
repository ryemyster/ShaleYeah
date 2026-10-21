# How the QA employee works

The selected architecture is **Stand-alone Agent with Progressive Disclosure
(Skills)**. Native ADK runs one specialist and its tools. Installable employee
helpers supply provider configuration, scoped context, bounded events and restart
supervision; the QA package owns its role instructions and tool mappings.

The QA MCP server owns deterministic observed rules and immutable reports. The
employee reads exact results, preserves counts, evidence, disagreements and
`FAIL`/`UNTESTED`/`ERROR`, and proposes a separate disposition work product. The
original recorded result remains unchanged. Optional synthesis is an unreviewed
note and cannot override the rule profile or verdict.

Each employee has its own customer/asset/task/employee context namespace. The host
supplies authenticated context grants and current source metadata authority. The
catalog limits retained records, source age, bytes and tokens, and keeps exact
source/work revisions and pending questions. Native callbacks assemble that
context for each request and recheck permissions before dispatch. Credentials and
raw conversations are not promoted into shared knowledge.

**Human review is an executing-backend gate.** The shared review state machine
binds the exact task, rule result, disposition policy, source bytes/evidence,
work, context, evaluation and action. A separate enrolled human inspects and
approves, rejects or requests changes. Current trusted qualification must bind
that same packet and product. The native confirmation UI and model messages do
not approve a disposition. Recording is idempotent and private; stale, expired,
foreign or revoked authority blocks continuation after restart too.

QA source hooks accept authorized normalized JSON exports and canonical work
products through the backend's host-owned input authority. Native source metadata
uses the explicit JSON-source profile `0.2.0`; employee work/context records stay
`0.1.0`. Raw LAS/CSV imports retain their separately selected `0.1.0` source
profile. Source repair and upstream licence checks belong to the source owner.
The tool server and employee install and deploy independently.

Before retaining a disposition draft in context, the native preparation tool
re-reads its exact backend-derived work and policy. Edited model claims are
rejected before catalog writes. The successful prepare response records the
real pending review reference, which survives restart without storing a grant.
