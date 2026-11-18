# Architecture

Primary mode: **Stand-alone Agent with Progressive Disclosure (Skills)**. One
native ADK specialist reasons over bounded permitted evidence and uses an
installed MCP client to reach an independent tool server. No child agents or
coordinator are required.

`app/agent.py` owns instructions and tool exposure. `curve_smith_mcp.py` maps
task/source/forecast identifiers to MCP. `context_runtime.py` adds this role's
source, work and pending-review references around the installed native employee
runtime. `evaluation.py` grades actual final output against trusted backend
observations and independent frozen references.

The MCP backend owns source mapping, fixed-b calculations, exact human review
and private save. Its durable review adapter is a deterministic business-state
gate. A separate enrolled human API supplies approval; neither ADK confirmation
nor model output grants authority. Models/providers, MCP, storage and deployment
remain replaceable adapters around the employee contracts.

Private context is isolated by customer, asset, task and employee. Current grants,
source rights, retention, reference-preserving limits and exact review bindings
remain enforced across restart. Secrets stay host-owned; raw model output cannot
silently become retained or shared knowledge. Redacted structured events correlate
task, model, tool, context, evaluation and review activity.
