# CI selection and required gates

Continuous integration (CI) checks code before a merge and again on the actual
merged commit. A pull request (PR) gets the full workspace checks plus the
employee qualification affected by its changes. Develop/main pushes and manual
CI runs execute the full current suite. Security scans keep their own workflows.

## What always runs

- Issue-template and sequential-delivery checks, including the current issue,
  branch ancestry and PR body on develop PRs.
- CI policy tests, workspace build, lint, type checks and the full workspace
  test suite. Tests remain serialized on constrained runners.
- Contracts/connector isolation and native model-adapter coverage.
- The final protected `PR checks` gate. CodeQL and secret detection retain their
  existing required check identities and sources.

`Workspace checks` starts independently of container qualification. The final
gate waits for both and explicitly checks their results. A failed dependency
cannot silently turn the final gate into an accepted skip.

## Which qualification a PR selects

| Changed unit | Qualification selected in addition to workspace checks |
| --- | --- |
| Geologist or Geowiz | Geologist and Reporter; Reporter also uses Geologist tests and Geowiz |
| Reporter employee or server | Reporter |
| Economist employee or Econobot | Economist |
| QA employee or QA server | QA |
| One of the nine current Python caller packages or its backend | That caller's locked package checks |
| Curve-smith backend | Workspace checks; Reservoir Engineer adoption/qualification remains a separate required output |
| Root README, architecture, contributing or changelog; reviewed CI/SDLC and MVP/legacy ledger docs | Workspace checks |
| Shared SDK, contracts, connectors, evaluations, workflow/CI scripts, root configuration/data or unknown paths | Full qualification |

Only the explicit documentation allowlist receives that exemption. Package-local
docs belong to their package. New Markdown, runtime prompts, skills, policies,
datasets and executable files select their owner or full verification.
Unmapped/new paths select full verification until ownership is defined.

The impact command uses a complete local Git comparison with full checkout
history. Renames include both old and new paths. Missing, invalid, divergent or
oversized comparison information selects full verification; it cannot produce
a partial selection. A mismatch between the checked-out revision and the
declared tested revision fails. Full events never omit qualification.

The `ci-impact-<run>-<attempt>` artifact records the event, base/head/tested
revisions, selected units/callers and reason codes. It contains no PR body,
source payload, model output or credentials. It is a selection record; passing
qualification reports remain separate and bind the revision actually tested.

## How results are checked

The reusable reference workflow validates every selected child and its effective
input flags before its aggregate can pass. The final gate validates impact,
workspace, reusable qualification and QA results. Selected work must report
success. Failure, cancellation, missing results and unexpected skips block.
An explicitly unaffected job may be skipped, and extra work that fails also
blocks. Unselected work is never reported as newly qualified.

Reusable workflow defaults select full qualification. Caller roles are passed
as JSON data through environment variables and validated against the known role
set. One runner then executes each selected caller's existing lint, tests,
imports and dependency-version checks. Each command uses its own package
directory and locked Python environment in a separate process; a failure stops
the driver. The job does not combine employee apps, context or approval state.

The currently adopted employees keep their frozen evaluations, native provider
journeys, source/review/restart controls, coverage floors, archive/wheel checks
and separate non-root container journeys. Other callers' shape/connection tests
do not establish full employee or professional qualification.

## Test and extend the policy

From the repository root with Node 22 or newer and locked workspace dependencies:

```sh
pnpm test:ci
pnpm test:sdlc
```

The first command tests impact decisions with real temporary Git histories,
result-gate failures and caller process isolation, and requires 90% CI-script
line coverage. The second verifies the shared issue/branch/merge delivery flow.
Neither replaces package-local checks, full hosted qualification or review.
Actions YAML can also be checked with `actionlint` before pushing a change.

When adopting another employee, add its owning checks, dependency mapping,
workflow inputs, default full behavior and aggregate-result expectations in the
same PR. Add controls for its own paths and dependents. Unknown impact stays
full, and an unmapped result cannot become success. The fleet gate and final
candidate must still prove every adopted employee at the actual revision.

SDLC completion still requires successful actual merged push runs for CI,
CodeQL and secret detection. No earlier artifact substitutes for those runs.
Fixture qualification does not grant human business approval or MVP acceptance.
