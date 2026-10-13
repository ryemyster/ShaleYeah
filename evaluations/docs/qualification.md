# Reference qualification and protected saves

Qualification asks whether a specific employee version satisfies its approved
scorecard. It does not approve an employee's action. Geowiz requires both a
passing qualification and a separate, exact human decision before a private save.

## What runs in GitHub

CI and release packaging call the same
[`reference-qualification.yml`](../../.github/workflows/reference-qualification.yml).
It has no file filters or optional failure flag. It checks the installed portable
evaluation and client packages, Geologist, project shape, source access, human
review, protected continuation and actual MCP (Model Context Protocol) transport.
The TypeScript workspace keeps its existing checks.

The last step compares seven source/policy fixtures against
[`baseline-reports.json`](../../agents/geologist/tests/eval/fixtures/baseline-reports.json).
The baseline reports are committed bytes; CI never regenerates them. Changed
fixtures or profile hashes require a reviewed replacement baseline and policy.
The decision records the exact GitHub SHA, profile/dataset hashes, candidate and
baseline versions, policy revision/approval, failed checks and score drops.
The artifact contains metadata only, is retained for 14 days, and is required
when qualification runs. A failed earlier package step also fails the job;
missing artifacts cannot turn that failure into a pass.

CI uses public demo LAS bytes, authored employee work and a scripted qualitative
judge. Passing means **offline fixture conformance**. The release package states
this limit in `QUALIFICATION.txt`; live models, scientific conclusions, other
roles and human MVP acceptance need their own evidence. No paid key is required
or silently substituted. Opt-in live scoring uses the existing Geologist
[private judge configuration](../../agents/geologist/docs/LOCAL_TESTING.md#run-adk-evals).

## Change standards through reviewed configuration

[`qualification_policy.json`](../../agents/geologist/tests/eval/qualification_policy.json)
is the approved fixture-only policy. Its 0.1.0 schema is exported as
`shaleyeah_evaluations.qualification.POLICY_SCHEMA`. It declares:

- Exact performance profile ID/version/hash and all reviewed case IDs.
- Control, edge and capability-boundary families, expected outcomes and required
  named failures. Negative controls must remain blocked for the intended reason.
- Exact candidate and frozen baseline model/runtime/harness versions.
- Aggregate and per-metric maximum score drops; current limits are 0.01 and 0.02.
- `fixture` or `live`, and the approving operator, time and issue/review reference.

Change limits, cases or approved profile settings in a PR, increment the policy
revision and retain its approval evidence. The current initial policy is covered
by the maintainer's approved issue plan and owning PR review. New baselines must
be inspected independently before approval; copying current scores over the old
baseline is not a valid regression review.

Nine deterministic gates cannot be waived through this policy or role tuning:
contract schema, provenance, freshness, assumption labels, authority, Geologist
architecture, tool boundary, no unapproved persistence and numerical measurements.
The verifier recomputes them from frozen host evidence. A missing judge in a
passing case, invalid profile/dataset, changed versions, missing case, forged
deterministic score or configured regression blocks qualification. Already
blocked cases skip qualitative scoring as before.

Initial scientific targets can be researched and reviewed by Codex using public
standards, worked examples and independent tools, with citations, assumptions
and gaps recorded for contributor refinement. No outside geologist is required
to start that benchmark. This does not supply measured 80 percent accuracy or
named professional acceptance. The current seven fixtures check literal source
values and trust failures, not broad scientific performance. The later MVP
human/release gates in [the plan](../../docs/mvp-release-plan.md) remain explicit.

## Supply trusted runtime evidence

The host that observed execution supplies evidence outside model tools, prompts
and agent memory. It binds the actual task, source artifacts, observations,
work product and native trace before calling `grade_dataset`/`run_case`. A frozen
record has exactly `report`, `trace`, and `runtime`. Use the existing
`normalize_case` for native ADK traces and `EvaluationContext.data()` for runtime
evidence. Authentication happens at the host boundary; hashes identify content
and do not authenticate a reviewer or model run.

For a protected save, write an owned 0600 JSON bundle in an owned 0700 evidence
directory, outside the repository and employee access. The file name is the
review packet's digest plus `.json`. Its closed shape is:

```text
schemaVersion: "0.1.0"
kind: "qualification-evidence"
codeRevision: exact deployed commit SHA
profile: validated performance profile object
datasets: map of dataset ID to base64 of exact dataset bytes
evidence: complete current frozen records
baseline: complete approved frozen records
expiresAt: bounded future UTC deadline within original evidence retention
```

Write the approved qualification policy separately as an owned 0600 JSON file.
The host must enforce original source/trace retention and remove expired bundles;
this verifier adds no background collector or permission to retain raw evidence.
Run its metadata-only check through the installed evaluation 0.3.0 wheel:

```sh
/absolute/venv/bin/python -I -m shaleyeah_evaluations.qualification \
  --bundle /private/evidence/packet-digest.json \
  --policy /private/qualification-policy.json --code-revision <deployed-sha>
```

For CI's public fixture files only, `--fixture-inputs` relaxes private permissions
and still requires fixture qualification. The Geowiz adapter never sets it.
It supplies the exact packet digest, full work product, qualification and passed
case ID on bounded stdin with `--promotion-stdin`. The case must pass and its
frozen work must equal the packet work. A live request cannot use fixture
qualification or a declared fixture model/judge/harness.

## Wire Geowiz without giving the employee a gate switch

Add `qualificationConfigFile` to the private review configuration. Its owned
0600 JSON settings contain `schemaVersion: "0.1.0"`, absolute `pythonExecutable`,
`evidenceDirectory`, `policyFile`, deployed `codeRevision`, and the passed `caseId`.
The executable's environment must contain the independently installed evaluation
wheel; it does not need the agent package or provider SDK. Geowiz invokes only
the fixed verifier module, without a shell, inherited keys or model-selected paths.
The process has bounded input/output, a 15-second deadline and cancellation.

Approval and continuation both require a current, exact work/scope/task/product
binding. Approval records the qualification receipt hash and tightens grant
expiry to its deadline. Changed qualification, expiry, missing evidence or an
unavailable verifier blocks continuation and requires fresh evaluation/review.
Existing approved grants without a qualification receipt cannot continue after
upgrade. Reject/request-changes and inspection remain available. Removing review
`requiredGates` cannot disable this mandatory check.

Portable hosts can instead inject `ReviewWorkflowOptions.qualificationGuard`
with the same trusted receipt contract. This is an operator boundary, not an MCP
tool. Remote IAM, hostile same-user processes, replicas, old-store rollback and
external-write transactions require their own qualification. The independent
package/container journey is the next reference issue.
