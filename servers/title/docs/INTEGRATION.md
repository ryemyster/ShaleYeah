# Title tool and human review integration

Configured MCP tools use host-derived identity. Callers cannot supply a principal, credential or output path in arguments. Source metadata and reads require current source/customer/asset/task/employee rights; drafting also requires export permission.

| Tools | Arguments / result |
| --- | --- |
| `read_title_inputs` | Exact `taskRef`; source inventory, examination and policy |
| `read_title_source` | Exact `sourceRef`, code-point `offset`/`maxChars`; bounded JSON source page |
| `read_title_instrument` | `taskRef`, `instrumentRef`, `sectionId`, pagination; original text and recording/scope identity |
| `cite_title_instrument` | Same selection, literal `quote`, optional occurrence; backend-computed UTF-8 span/hash |
| `get_context_source_metadata` | `sourceRef`, `operation` read/export; current permitted metadata without text |
| `examine_ownership`, `trace_chain_of_title`, `check_burdens`, `analyze_lease` | Exact `taskRef`; selected source-derived view and exceptions |
| `draft_title_packet` | `taskRef`, work `revision`, proposal `{version,title,observations}`; canonical `work`/`title` |
| `prepare_title_review` | Exact candidate `work,title,context,evaluations`, expected previous digest or null |
| `title_review_status` | Optional scoped `reviewId`; durable current checkpoint |
| `record_title_packet` | Exact `reviewId`, `packetDigest`, `grantId`; qualified private recording receipt |

Each proposed observation names `observationRef`, `questionId`, `kind` (observation/exception/question), a statement and exact instrument citations. All requested questions and required instruments need citation coverage. Syntax/byte validity does not establish semantic legal entailment; proposed interpretation remains for the human reviewer.

## Separate human workflow

From the backend package, with `TITLE_CONFIG_FILE` selecting current operator/reviewer enrollment:

```sh
node examples/review.mjs inspect REVIEW_ID /absolute/private/new-packet.json
node examples/review.mjs decide REVIEW_ID PACKET_DIGEST request_changes /absolute/private/reason.json
```

Inspection creates a new 0600 file, refuses overwrite/symlinks and prints only receipt metadata. Inspect the source bytes, calculation assumptions, proposed observations, common work, context and installed evaluation evidence there. The private reason JSON contains `reason` and optional measured `humanReviewSeconds`/`corrections`. Choose `reject` or `approve` in the same command when appropriate.

A change request does not edit sources. Revise the actual operator exports/assumptions, issue current artifact/task revisions, redraft and prepare with the expected head. Approval is tied to the exact digest and current qualification/source/reviewer authority. A changed revision or revoked grant requires fresh review. The model tool list has no human approve/decide command.

Install qualification evidence with the role's `tests/eval/run_fixture_evals.py --packet ... --observed ... --evidence-directory ... --output ... --code-revision ...`, using the inspected packet and actual output. Configure the private verifier with Python executable, evidence directory, policy file, tested revision and `caseId: "control_base"`. See the employee [evaluation guide](../../../agents/title-analyst/docs/EVALUATIONS.md). The installed verifier rebuilds reports and binds exact output; a claimed passing label is insufficient.

`record_title_packet` records the approved private packet once. Restart/retry returns the same receipt; it grants no filing, conveyance, curative, lease or capital authority, title clearance, legal opinion or professional acceptance.
