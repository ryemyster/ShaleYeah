# Architecture

Curve-smith is independent MCP tooling for the **Stand-alone Agent with Progressive
Disclosure (Skills)** Reservoir Engineer. It has no agent reasoning loop and
requires no coordinator.

`arps.ts` owns finite numerical integration/cutoff behavior. `type-curve.ts`
fits each well under the declared fixed b and forms an equal-well mean.
`forecast-service.ts` binds current JSON sources, reconciles units/time/grain and
operating basis, separates training/holdout and constructs canonical work.
`source-hooks.ts` supplies the installed normalized public/internal snapshot seam;
the default private-file binding is in `configuration.ts`.

`employee-tools.ts` exposes bounded MCP calls with current trusted principals,
timeouts/cancellation and typed failures. `review-workflow.ts` adds role-specific
truth/context checks to the installed durable review store. Separate enrolled
human authority and installed qualification gate the exact private save. Model
text and native confirmation cannot grant it.

The package declares its contract, connector identity and SDK dependencies and
has its own build configuration. Python grading lives in the independent
evaluation package. Required redacted events correlate source/task/tool/context/
review work; host configuration supplies identity, current grants and secrets.
