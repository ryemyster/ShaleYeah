# Econobot architecture

Mode: shared contract/process only. This package is a deterministic TypeScript
MCP tool server, independently usable by the Economist or another compatible
agent. The employee's reasoning and own context remain separate.

`src/cash-flow.ts` owns the qualified periodic net-cash-flow calculations.
`src/scenario-service.ts` reads exact authorized operator exports and preserves
financial assumptions, source/as-of revisions, currency and timing. Every basis
reference must resolve; ownership and price dates are reconciled with actual
source evidence. It does not reconstruct proprietary fiscal models.

`src/configuration.ts` binds private host files to the installed connector runtime,
current grants, read/export rights, content scanner and required audit sink.
Source IDs are not credentials. Changing bytes, task/source revisions or current
rights invalidates earlier work. The default local file mode attests operator
rights; enterprise hosts must supply their own authoritative identity/permissions.

`src/review-workflow.ts` specializes the installed review state machine. It
rederives current work/scenario on prepare, inspection, human decision and private
save. Full source text is available to the enrolled human; model tools receive
bounded pages and canonical computed objects. No human approval tool is exposed
through MCP. Installed qualification and exact-revision grants are required;
transactional private storage and replay return the same completed outcome.

`src/employee-tools.ts` supplies bounded query/command mappings and safe errors.
Cancellation reaches source reads and review preparation. `src/source-hooks.ts`
normalizes explicitly supplied EIA APIv2-shaped observations; it does not fetch
live prices, infer forecasts or grant redistribution rights.

`src/index.ts` retains the three direct calculation tools. Without private
configuration they require no model, source files or database. Optional host
synthesis uses the shared model adapter and remains unreviewed text. It cannot
change calculations or authorize spending. A configured employee workflow adds
its own private SQLite review store and portable installed evaluation verifier.
No warehouse, orchestrator or single cloud is required.
