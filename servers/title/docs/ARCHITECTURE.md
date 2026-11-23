# Title backend architecture

Title is the deterministic source/review backend for a **Stand-alone Agent with Progressive Disclosure (Skills)**. It runs independently of the Python employee with a generic MCP client. Shared SDK serving handles the protocol, identity, audit and execution boundary.

`title-packet.ts` parses bounded supplied instruments, reconciles rational holdings/burdens and validates original UTF-8 citations. `title-service.ts` binds current task, bytes, source grants, scope, freshness, export permission and content scanning. `configuration.ts` loads private operator files; `source-hooks.ts` supplies the normalized download/API seam.

`employee-tools.ts` exposes 13 bounded source/calculation/draft/review tools. The public entry advertises no work without configuration. `review-workflow.ts` adapts the installed shared review workflow to exact Title sources/work/context and the private `record_title_packet` transition. It does not introduce another approval state machine.

A separately enrolled qualified human must inspect and approve the exact currently qualified packet. Model tools cannot approve work. Current sources, authority, evaluation and revision are checked again before private recording. This grants no legal title opinion, clearance, filing, curative, transfer, lease or capital authority.
