# Using Risk Analysis
A trusted host may construct `RiskAssessmentService`, `RiskReviewWorkflow` and `RiskAnalysisServer` using installed package exports. Supply current task/source authority callbacks and a scanner. No tool argument selects identity, endpoint, credential, verifier or output path.

## Operator files
`loadRiskBinding` (in `dist/configuration.js`) reads an owner-only binding file. All file paths are absolute. The private state directory and audit file belong to the current operating-system account. The binding includes:
- `version: "0.1.0"`, `sourceAuthority: "operator-attested-export"`, qualification mode and event correlation;
- canonical task, `registerSourceRef`, `policySourceRef`, `scenariosSourceRef`, and exactly three `sources` entries, each with private file and source envelope;
- current `sourceGrant` (subject, allowed source IDs, expiry, revocation) and `sourceOperations`;
- enrolled `localOperator`, scanner `sensitiveFiles`, freshness limit, private directory and audit path;
- optional `review` with exact policy, enrolled `localReviewer` and a host-selected `qualificationConfigFile`.

The task's inputs must match all three exact source references. Changing byte identity or required authority invalidates earlier results. Start a new bound revision for changed sources. See [schemas and limits](INPUTS.md).

## MCP calls
A calculation takes `{taskRef: {id, revision}, modelRef: {id, revision}}`. A comparison takes `modelRefs`; a draft adds its work `revision`. Discovery returns model summaries; source text is paged separately. The selected MCP profile is 2026-07-28.

## Enrolled human review
The host calls `prepare_risk_review` with exact work, risk, context, evaluation references and expected current head. The backend rederives work and sources; claimed eval labels cannot replace installed qualification.

From the package directory, with `RISK_ANALYSIS_CONFIG_FILE` set:
```sh
node examples/review.mjs inspect REVIEW_ID NEW_PRIVATE_PACKET_FILE
node examples/review.mjs decide REVIEW_ID PACKET_DIGEST request_changes PRIVATE_REASON_JSON
node examples/review.mjs decide REVIEW_ID PACKET_DIGEST reject PRIVATE_REASON_JSON
node examples/review.mjs decide REVIEW_ID PACKET_DIGEST approve PRIVATE_REASON_JSON
```
Inspection writes a new owner-only packet file. The private reason file contains `{"reason":"..."}` and may include actual `humanReviewSeconds` and `corrections`. The enrolled human must inspect the exact policy, sources, assumptions, work and context before deciding. Source changes require fresh work and review; decision prose cannot waive blockers.

Approval and execution both require a host-selected installed verifier bound to packet digest, work hash, scope, task and product revision. The raw mathematical packet remains immutable and unreviewed; the separate human decision records approval of the exact private action. Neither produces a compliance certificate or capital authority.

After approval, the employee's fixed record operation revalidates authority and saves once. Restart reads the durable checkpoint; replay returns the same record. Missing qualification, changed policy, retired review or revoked sources block execution.

## Source hooks and substitutes
`createRiskSnapshotHook` consumes host-selected normalized public/internal JSON snapshots with current grants, exact hashes, scope, freshness, scanner and audit. Credentials are resolved outside source/output text. Vendor-native API mapping, paid access and redistribution rights require separate evidence. Compatible external-tool fixtures qualify argument/transport/result mapping only.

Licensed inputs require an authorized operator export or internal normalization path with the applicable usage policy and license notes. The local operator attests those upstream rights; a credential reference does not establish vendor permission. No named paid connector is qualified by this package.
