# Risk source contract
Three JSON documents are required. They use domain version `0.1.0`, the existing JSON source envelope `0.2.0` and employee records `0.1.0`. Source metadata is not a professional certification.

Each document declares a three-letter uppercase `currency` and UTC `horizon.start/end`; these must agree. No exchange conversion or period inference occurs. Exact source bytes have a SHA-256 hash, byte length, source revision, as-of time, task/customer/asset/employee scope and permitted usage policy in their source envelope.

## Register
`entries` contains 1–64 hazards. Each has `riskRef`, category, statement, consequence, severity and `severityBasis`, evidence state/references, conflicts, and mitigation state/owner/nullable verification reference.

Categories are geological, technical, economic, regulatory, environmental and operational. Severity is low, medium, high, critical or unknown. Missing evidence, conflicting evidence and unknown severity stay explicit. The operator attests upstream specialist review and rights; referenced statements are not independently validated field truth.

## Operator policy
The policy declares `policyRef`, required categories, escalation severities, maximum unmitigated severe risks, maximum expected loss, maximum tail probability and a loss threshold. Values are explicit; no default risk score or acceptance limit is supplied.

A verified mitigation requires a verification reference. Coverage retains severe hazards even when the model assigns them zero occurrence probability. Missing categories/evidence, conflicts, unknown severity and exceeded limits produce canonical work blockers.

## Complete joint scenarios
The third document is `{"version":"0.1.0","models":[...]}`. Up to 32 models each declare:
- `modelRef`, `method: "complete-joint-scenarios-v1"`, positive `totalWeight`, `exhaustiveWithinDeclaredModel: true`;
- explicit `dependenceBasis`, at least one limitation, currency and horizon;
- 1–512 states with exact `stateRef`, integer `weight`, occurring `riskRefs` and nonnegative `residualLoss`.

Weights are 0–1,000,000,000 and must sum exactly to the declared total (at most 512,000,000,000). Losses are at most 1,000,000,000,000 currency units. Source metadata declares `residualLoss` in the same currency. The loss is the total for that joint state; overlapping marginal consequences are not silently added.

References must resolve to current register revisions. Duplicate risk/state/model identities and incomplete mass are rejected. Reference IDs/revisions use canonical identifier characters; model IDs are limited to 96 characters to leave room for derived finding IDs. Combined source bytes are bounded to 8 MB. See [executable schema](../src/joint-scenarios.ts) for all limits.

These are complete states within a declared model, not a claim that every real-world outcome is known. Unsupported Monte Carlo sampling, incomplete marginal inputs, inferred independence, field probability calibration and financial NPV/IRR must defer.
