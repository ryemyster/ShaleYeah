# Legal Analyst architecture

The selected mode is **Stand-alone Agent with Progressive Disclosure (Skills)**. One native ADK/Python agent reads authorized source material on demand and proposes a cited memo. The independently runnable TypeScript Legal MCP backend validates source identity, quote spans, declared applicability and coverage, and enforces human review.

`app/agent.py` constructs the agent with installed model/provider, budget and event helpers. `app/legal_mcp.py` maps its fixed tools to the configured MCP service. `app/context_runtime.py` embeds the installed durable runtime, retaining permitted source identities and exact working/review references under customer, asset, task, employee and principal scope. Model history cannot substitute for current source authority.

The shared backend review business-state adapter owns prepare, inspect, request changes, reject, approve and execute transitions. It binds exact sources, proposed analysis, work, context and qualification revisions and revalidates them on continuation. This is an executing review gate; it does not change the agent into an ADK graph.

The agent may retrieve, compare and propose analysis within current rights. Private recording requires separately enrolled human review and installed qualification. Recording does not grant legal clearance, professional certification, contract approval, signature/filing/waiver/settlement or capital authority. Source-date metadata and reviewer enrollment are operator assertions. Legal interpretation and materiality remain human judgments.

See the [backend architecture](../../../servers/legal/docs/ARCHITECTURE.md) and [evaluation limits](EVALUATIONS.md).
