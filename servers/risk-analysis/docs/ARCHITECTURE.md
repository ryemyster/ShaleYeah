# Risk Analysis architecture
This independent tool backend separates source truth, mathematical appraisal and business authority.

- `risk-service.ts` binds the current task and three source identities, validates exact bytes and metadata, checks current read/export authority and rechecks it at delivery.
- `joint-scenarios.ts` validates domain inputs and calculates complete joint states. This pure helper grants no access or approval.
- `review-workflow.ts` supplies the role adapter around installed durable review transitions. It rederives exact work/risk, binds retained context and requires all trust gates.
- `employee-tools.ts` exposes bounded MCP operations with host identity, cancellation and deadlines.
- `configuration.ts` loads private local exports, current grants, enrolled operator/reviewer identity, required audit and the installed verifier. `source-hooks.ts` is the normalized public/internal snapshot seam.

Contracts/source profiles, connectors and SDK helpers are declared installable dependencies. The backend imports no employee source. Independent MCP clients can use it directly. The agent's ADK runtime, providers, private context and reasoning remain in its own package.

The executing backend enforces exact-revision human approval and installed job qualification before private recording. Requested changes, rejected or superseded packets, revoked source rights, changed policy, replay and unsafe content are checked in code. Required gates cannot be removed from review configuration.

The local source authority is an operator-attested export: it checks the supplied bytes, rights and task binding, while the operator attests upstream sharing/review. It does not independently certify upstream professional truth or vendor rights.
