# Reporter architecture

The primary mode is **Stand-alone Agent with Progressive Disclosure (Skills)**.
One native ADK employee uses bounded tools; it has no child employees. The tool
server owns source authority and deterministic human-review transitions.

`app/agent.py` defines the role. `app/reporter_mcp.py` maps its tools to the
installed Python MCP client. `app/context_runtime.py` supplies the role factory
to the shared employee runtime. Context is scoped to the customer, asset, task,
revision, employee and authenticated operator. The trusted embedding host supplies
current task/source/review grants, retention and context budgets. Native SQLite
sessions and checkpoint recovery revalidate these grants before model access.

The host uses the shared `ContextCatalog` to retain its task, permitted reviewed
shared work, private drafts and pending-review references. Raw model output is
not promoted into shared knowledge. Report evidence uses explicit reviewed
business-artifact references; it does not claim raw LAS/CSV connector support.

The owner reviews inputs and exact outputs, can request changes, and approves the
new qualified revision. The executing backend binds that decision to the report,
context, source bytes, task and configured private destination. Edits, revocation,
expiry or changed qualification invalidate continuation. Retries return the same
private stored report. ADK confirmation is an interaction aid, not authority.

Model assistance can produce an optional unreviewed cited note. It cannot change
measurements, approve publication or replace the source-linked report. Credentials
and credential references are excluded from model context and metadata exports.
