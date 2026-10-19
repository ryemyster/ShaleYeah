# Econobot architecture

Mode: shared contract/process only. This package is a bounded TypeScript MCP
tool server. The Economist employee, its context and human review remain
separate responsibilities.

`src/cash-flow.ts` validates one versioned periodic cash-flow contract and owns
all numerical calculations. `src/index.ts` exposes three tool entry points
through the shared SDK. Analysis and scenario comparisons call the same
calculator; a model cannot supply or replace NPV, IRR or payback.

The default CLI uses deterministic tools without a provider key or file access.
A host may explicitly configure the existing shared `callLLM` adapter for an
unreviewed explanation. Provider failure leaves the original calculations intact.
Model text is returned as text, never parsed as numerical truth or approval.

Inputs carry currency, period, discount convention and revision references.
References are provenance labels, not an authority grant. Outputs always remain
unreviewed and cannot authorize spending. Authentication, scopes and audit for
HTTP are enforced by the shared SDK configuration. Full employee review/context
adoption is owned by issue 680.

The package depends on the SDK and Zod. There is no mandatory model, database,
warehouse or orchestrator. Its generic-client test runs the built server from a
separate directory and verifies actual calculations and schema failures.
