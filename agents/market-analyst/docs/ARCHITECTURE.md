# Market Analyst architecture

Market Analyst uses **Stand-alone Agent with Progressive Disclosure (Skills)**.
One ADK agent selects tools and requests bounded source detail. ADK owns its
reasoning loop; the shared employee runtime owns model budgets, private context
and lifecycle callbacks. The separate Market MCP service owns source arithmetic,
current authority, exact review state and protected recording.

| Component | Responsibility |
| --- | --- |
| `app/agent.py` | Configured native agent, role instructions, callbacks and tool declarations |
| `app/market_mcp.py` | Installed MCP client wrappers; canonical draft and context binding before review |
| `app/context_runtime.py` | Retain authorized source/work references, assemble context and preserve pending review across restart |
| `app/evaluation.py` | Parse the actual final response and grade it against trusted host observations |
| `app/review_supervision.py` | Map Market operations to the shared review supervisor |

The host supplies task, scope, source authority, retention and model profiles.
`MarketAnalystRuntime.open` assembles permitted context before model dispatch and
uses `include_contents="none"`; retained records replace raw prior chat replay.
Revocation or input revision changes prevent continued use of old evidence.
Raw model text never promotes itself to working or shared knowledge.

The backend reads exact mandate, series and assumptions JSON. It preserves native
units, location, observation periods, publication vintage and retrieval time.
Applicable supplied heat content is required for gas volume/energy conversion.
Explicit future assumptions cannot become observed or licensed forward prices.

Review preparation re-drafts the proposed interpretation from current sources,
checks the exact work and scenario, and supplies the host's current context.
The human inspects a private packet and separately approves, rejects or requests
changes. Installed qualification and current source rights are checked at both
approval and execution. A restart can resume only that exact approved operation,
with replay returning the original stored result.

The agent and backend use declared shared packages. Neither imports another
specialist's implementation. The optional orchestrator is outside this package's
runtime. See [integration](INTEGRATION.md) and [evaluation](EVALUATIONS.md).
