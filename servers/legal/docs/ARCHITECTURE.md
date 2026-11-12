# Legal backend architecture

The paired employee uses **Stand-alone Agent with Progressive Disclosure (Skills)**. This backend is an independently runnable deterministic MCP service. Its shared review business-state adapter enforces human decisions without becoming an agent reasoning loop.

`legal-service.ts` binds the current task to exact authorized matter, corpus and checklist exports, verifies fresh byte identities and source rights, and provides bounded source queries. `legal-memo.ts` validates the employee's proposed issues, exact quotations, provision-level declared applicability, required questions/document revisions and conflict retention. It derives canonical unreviewed work rather than a prewritten legal answer.

`employee-tools.ts` exposes ten fixed queries/commands. `configuration.ts` loads private operator exports and current enrollment/grants, scans configured secrets separately and requires redacted audit events. Source bytes participate in final authority checks even when the binding file is unchanged. `source-hooks.ts` provides a normalized public/internal snapshot seam under current rights; it qualifies no paid vendor mapping.

`review-workflow.ts` uses the installed durable review protocol. It rederives current work at prepare, approval and execution, binds all exact source/context/evaluation revisions, and rejects stale authority or replay. Qualified human review and installed qualification are required for recording. The source-date assertions and reviewer enrollment are operator-attested, not automated legal truth or license verification.

See [inputs](INPUTS.md), [integration](INTEGRATION.md) and the employee's [evaluation limits](../../../agents/legal-analyst/docs/EVALUATIONS.md).
