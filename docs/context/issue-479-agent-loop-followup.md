# Issue 479 Agent Loop Follow-Up Context

Date: 2026-06-18

Issue 479 extracted the shared agent execution loop from the geologist/geowiz prototype into the SDK.
The intended architecture remains isolated specialist agents first, with hierarchy/orchestration deferred until
isolated agents are clean and useful by themselves.

Current reference pattern:

- `servers/geowiz` owns the Tier 1 MCP geology tools.
- `agents/geologist` owns manifest, config, geowiz MCP handlers, compensation registration, and CLI glue.
- `sdk/src/agent-loop.ts` owns the shared Layer 2 task loop via `runAgentTask`.
- `runGeologistTask` is now the reference wrapper around `runAgentTask`.

Next recommended work:

1. Review `runAgentTask` API ergonomics and freeze it as the fleet pattern if it still feels right.
2. Update issue #479 or its follow-up checklist to state that geologist is the reference implementation.
3. Migrate one small non-geologist agent next, preferably `market-analyst`, `research-analyst`, or `quality-assurance`.
4. After that second migration passes, migrate the remaining agents mechanically.
5. Update all related GitHub issues for remaining agents to say: do not copy a local `executeLoop`; use the SDK `runAgentTask` pattern.
6. Revisit orchestrator/hierarchy only after several isolated agents are clean and independently useful.

Why this matters:

The original plan was geologist/geowiz proves agent isolation, then the SDK absorbs common runtime machinery, then
other agents become mostly manifest/config/domain policy. The drift was that geologist's private loop was copied into
the rest of the fleet. Issue 479 corrects that by making the SDK loop the shared pattern.
