# Drilling tools and human review

Identity comes from the host, never tool arguments. Read/source/evidence operations require current customer/asset/task/employee/source permission; drafting also requires export rights. Tool arguments cannot supply credentials or file paths.

| Tools | Arguments and result |
| --- | --- |
| `read_drilling_inputs` | Exact `taskRef`; source inventory, design/options and policy |
| `read_drilling_source` | `sourceRef`, code-point `offset`/`maxChars`; bounded JSON page |
| `read_drilling_evidence` | `taskRef`, `evidenceRef`, `sectionId`, pagination; original evidence and well/design identity |
| `cite_drilling_evidence` | Same selection, literal `quote`, optional occurrence; backend-computed UTF-8 span/hash |
| `get_context_source_metadata` | `sourceRef`, read/export operation; current permitted metadata without text |
| `design_drilling_program`, `estimate_well_costs`, `assess_drilling_risks` | Exact task; supplied program, quoted-cost/schedule or hazard/offset view with exceptions |
| `draft_drilling_packet` | Task, work revision and proposal `{version,summary,observations}`; canonical `work`/`drilling` |
| `prepare_drilling_review` | Exact candidate `work,drilling,context,evaluations`, expected previous digest or null |
| `drilling_review_status` | Optional scoped review ID; durable current checkpoint |
| `record_drilling_packet` | Exact review ID, packet digest and grant ID; qualified private recording receipt |

An observation names `observationRef`, `questionId`, kind (observation/exception/question), statement and citations. Every requested question and required evidence revision needs citation coverage. Byte identity and coverage do not establish semantic engineering correctness.

## Separate enrolled engineer

With `DRILLING_CONFIG_FILE` selecting current operator/reviewer enrollment:

```sh
node examples/review.mjs inspect REVIEW_ID /absolute/private/new-packet.json
node examples/review.mjs decide REVIEW_ID PACKET_DIGEST request_changes /absolute/private/reason.json
```

Inspection creates a new 0600 file and refuses overwrite/symlinks. Stdout contains receipt metadata. Review exact sources, assumptions, observations, common work, context and installed qualification in that file. The private reason JSON contains `reason`, optionally measured `humanReviewSeconds`/`corrections`. Use `reject` or `approve` in the same command when appropriate.

A change request does not edit sources. Revise the operator exports/assumptions, issue current source/task revisions, redraft and prepare with the expected head. Approval binds the exact digest, current sources, enrollment and installed qualification; a changed or revoked revision requires fresh review. There is no human approval tool in the employee's model tool list.

Install evidence with the employee's `tests/eval/run_fixture_evals.py --packet ... --observed ... --evidence-directory ... --output ... --code-revision ...`, supplying the inspected packet and actual output. Configure the private verifier with Python executable, evidence directory, policy file, tested revision and `caseId: "control_base"`. See [evaluations](../../../agents/drilling-engineer/docs/EVALUATIONS.md). The verifier rebuilds reports and exact bindings; a claimed passing label is insufficient.

Recording is private documentation only. No spud, AFE/capital commitment, field operations, well-control, safety certification or professional acceptance follows.
