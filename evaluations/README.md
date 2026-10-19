# Employee evaluation profiles

An evaluation profile is an employee's scorecard. An operator can change reviewed
datasets, existing metric settings, rubrics, thresholds, weights and failure
actions in JSON. New executable evaluators belong in reviewed, installed code.
`shaleyeah-evaluations` supplies the profile schema, Python loader and trusted
deterministic metrics. It works independently of an agent framework, model
provider, MCP server, warehouse or coordinator.

The first consumer is [Geologist](../agents/geologist/README.md). Its
[profile](../agents/geologist/tests/eval/eval_config.json) and
[reference dataset](../agents/geologist/tests/eval/datasets/geologist-adk-reference.json)
are public fixtures. Their presence does not qualify professional geology or
every advertised source format.

## Install, validate and test

From this directory:

```sh
uv sync --locked
uv run --locked ruff check .
uv run --locked pytest -q --cov=shaleyeah_evaluations --cov-fail-under=90
uv run --locked python -m shaleyeah_evaluations \
  ../agents/geologist/tests/eval/eval_config.json --role geologist \
  --dataset geologist.reference=../agents/geologist/tests/eval/datasets/geologist-adk-reference.json
uv build --wheel
bash scripts/check-isolation.sh
```

The validator reports profile/version/hash metadata only. It runs no employee,
judge or dataset code. The isolation check installs the evaluation and portable
contract wheels into an empty environment and runs conformance against copied
fixture data. It imports no monorepo source or agent/model SDK.

External consumers install the declared `shaleyeah-contracts==0.3.0` and
`shaleyeah-evaluations==0.3.0` wheels. Local editable paths are contributor
convenience, not a deployment requirement. No registry publication is implied.

## Load and tune a scorecard

```python
from pathlib import Path
from shaleyeah_evaluations import TrustedEvalPolicy, load_profile

loaded = load_profile(
    Path("tests/eval/eval_config.json").read_bytes(),
    datasets={
        "geologist.reference": Path("tests/eval/datasets/geologist-adk-reference.json").read_bytes()
    },
    policy=TrustedEvalPolicy("geologist"),
)
print(loaded.config_hash)
```

The host supplies trusted policy separately. Profile JSON cannot replace it.
Choose registered metric IDs and exact evaluator versions; select datasets by
logical ID, reviewed revision and SHA-256 of exact bytes. The loader never fetches
a dataset URI or imports a module named in configuration. A changed dataset needs
a reviewed hash and profile revision update. The caller supplies bounded bytes
from its authorized storage boundary.

Change an existing quality threshold, rubric, weight or freshness limit without
editing Python. Thresholds and weights must be greater than zero. A freshness
limit can become stricter than the host limit. The five mandatory trust metrics
always have threshold 1, a hard gate and blocking failure. Geologist also requires
architecture and observed save-confirmation gates. A large weight on a passing
metric cannot cancel a failed hard gate. Unknown keys, evaluator versions,
executable definitions, duplicate IDs/JSON keys and non-finite numbers fail
before execution with value-free error codes.

## Installed metrics and evidence

| Metric ID/version | Required evidence |
| --- | --- |
| `contract.schema` | Canonical work product with exact customer/asset/task/employee scope, task revision and product reference |
| `evidence.provenance` | Evidence matches exact canonical source artifacts supplied by the trusted retrieval boundary; measured findings cite sources |
| `evidence.freshness` | Source as-of times are neither future nor older than the configured limit at the host's clock |
| `assumptions.labeling` | Assumed findings cite labeled assumptions; unknowns retain null values/reasons; measured findings cite evidence |
| `authority.boundary` | Observed dispatch/authorized-dispatch/unauthorized-action counts; claimed final/approved work also requires trusted verified review for the exact product reference |
| `geologist.tool_boundary` | Configured expected calls for every reviewed dataset case, without requiring an exact call order |
| `geologist.architecture_boundary`, v2 | Host-observed specialist topology, zero child agents and zero delegation events; missing observations fail |
| `numerical.measurements` | Every measured finding exactly matches a host-reviewed numeric value/unit and the bound evidence hash |
| `geologist.no_unapproved_persistence` | When approval is required, an observed confirmation pause and zero write dispatches |
| `response.rubric` | Versioned approved judge reference and rubric; remains pending until the runner executes the judge |

`EvaluationContext.from_trusted_runtime(...)` takes the host's scope, task/product
revision, clock, verified source artifacts and runtime observations. Employee
prose and trace `runtime_evidence` cannot substitute for these inputs. The host
must authenticate the task, enforce source access and derive observations from
actual execution, not copy model claims. These evaluators check evidence; they
do not grant permission or replace the executing backend's authorization gates.

`evaluate_metric(loaded, metric_id, frozen_trace, context)` produces a detached
score receipt with profile/schema/registry/evaluator versions, configuration,
trace and runtime hashes, scope and task revision. Reasons contain no source
text, prompt or credential. `summarize_scores(loaded, receipts)` rejects mixed
profiles, scopes, tasks or trace/runtime revisions. Missing metrics/judges remain
pending; critical failures remain failed; configured review failures request
review. Synthetic judge scores in arithmetic tests are not live judge evidence.

## Versions, hashes and migration

Package, schema and registry versions are separate. Package 0.3.0 accepts the
unchanged profile/registry 0.1.0 for compatibility and performance profile/registry
0.2.0. Performance requires architecture evaluator version 2 and the numeric
gate for Geologist. Other evaluator versions are 1. The old architecture word
check remains a legacy contract test and cannot enter the performance runner.
The exported `SCHEMA_VERSION`/`REGISTRY_VERSION` constants describe the preserved
0.1.0 API; receipts report the actual loaded profile versions. The loader accepts
only declared versions. It neither rewrites an unknown version nor executes old YAML.
Profile/trace/runtime hashes use SHA-256 of UTF-8
[RFC 8785 JSON canonicalization](https://www.rfc-editor.org/rfc/rfc8785), implemented
by the pinned [pure Python canonicalizer](https://github.com/trailofbits/rfc8785.py).
Equivalent number spellings and whitespace/order produce the same profile hash.
Dataset hashes bind exact bytes. Hashes identify content; they are not signatures
or evidence of reviewer identity.

To migrate an old profile: map executable metrics to reviewed registry entries,
prove equivalent control/failure behavior, set exact dataset hashes and metric
versions, remove displaced executable definitions, and rerun conformance. A new
schema or evaluator behavior needs a new version and explicit migration tests.
Keep the original profile/results for comparison within the host's authorized
retention policy. No implicit live migration or cross-customer store is added.

## Grade frozen work and compare candidates

`shaleyeah_evaluations.runner.run_case(...)` is asynchronous and consumes a
validated performance profile, one frozen trace, trusted context, explicit
candidate versions and optional `JudgeBackend`. The backend is a host-installed
async callable with a reviewed reference/model revision. Profile JSON never
loads its code or credentials. `validate_report(...)` checks the independent
[report schema](shaleyeah_evaluations/schemas/eval-report-0.1.0.schema.json) and
internal decision/hash bindings. These are integrity checks, not signatures or
proof of reviewer identity.

Each report preserves case/profile/dataset/schema/registry/evaluator/model/runtime/
harness/judge versions, exact customer/asset/task/employee scope, task/product
revision, configuration/trace/runtime/reference hashes and source ID/hash references. It
contains no raw prompt, response, source file, credential, exception message or
judge explanation. The qualitative request contains only employee response text, findings, assumptions,
uncertainty, blockers and review status. Raw prompts, tool results, source URIs,
authority observations and context are excluded. `judgeInputHash` binds that
minimized request without retaining it in the report. The host remains responsible
for source/employee-output redaction before sharing. Supplied candidate/judge
model revisions describe configured targets; real observation and execution
evidence remain with the host. Deterministic gates execute first. A failed mandatory gate
blocks and skips qualitative requests. A missing, failed, invalid or timed-out
judge produces `infra-error` and a null score. A qualitative failure requests
review or fails according to the profile; it cannot cancel a hard failure.
`promotionBlocked` is false only for a passing report. Actual promotion policy
is consumed by the [qualification verifier](docs/qualification.md); authenticated
approval remains at the host/backend boundary.

Optional host measurements include latency, observed cost/currency, review time,
corrections, rework, completion, escalation quality and tool failures. Unmeasured
values remain absent; model confidence is a separately labeled field. Tests use
synthetic measurements only. `compare_reports([baseline, candidate, ...])` requires
the same case, scorecard/hash, dataset and scope/revision. It preserves candidate
versions and flags differing repeated-candidate outcomes/trace hashes as possible
nondeterminism. This is a signal to inspect the runs, not a statistical proof or
an automatic winner selection.

Geologist owns the provider/framework-specific
[adapter and commands](../agents/geologist/docs/LOCAL_TESTING.md#run-adk-evals).
It consumes native ADK/agents-cli traces, binds separately authenticated products/
observations, and reuses its private BYO model boundary for qualitative scoring.
It also creates installed local Google evaluator callbacks; no configuration
Python is compiled. The portable package imports no ADK, model SDK, warehouse or
coordinator. [Source-linked fixtures](../agents/geologist/tests/eval/datasets/geologist-performance.json)
check the literal first depth/unit of the demo LAS and policy failures. Historical
source dates, scripted judges and synthetic review are explicit; geological
interpretation still requires a qualified professional.

Promotion gates use the [approved qualification policy](docs/qualification.md).
The Geologist remains a Stand-alone Agent with Progressive Disclosure (Skills).
Human approval, professional review, secret resolution/redaction and scoped
retention stay with the trusted host/runtime. This package persists no raw trace,
promotes no memory and requires no secret or paid request for CI.

## Correlated report export

Evaluation 0.3.0 consumes contracts 0.3.0 while preserving profile/registry and
report schemas. Geologist can export report/profile/product hashes through its
[role-local event adapter](../docs/employee-events.md#record-host-work-evaluations-and-review).
This core package gains no MCP, ADK or event-sink dependency. A missing judge and
a failed mandatory gate keep their actual outcome in the correlated event.

Reporter profiles use explicit reviewed-business-artifact evidence, literal
source reconciliation and disclosure coverage. Its mandatory publication,
architecture and tool gates are installed role metrics. Qualification policy
selects a supported role; Geologist and Reporter retain separate required gates.
Operator configuration can change cases and rubrics but cannot waive trust floors.

The quality-assurance role requires `qa.observed_faithfulness`,
`qa.architecture_boundary`, `qa.tool_boundary` and
`qa.no_unapproved_disposition` in addition to the shared trust floor. The host
reads the immutable QA report under current authority; the grader compares
actual output with that report and retains verdicts, counts, source and result
revisions. Reporting a real failed data check is correct employee behavior.
Role configuration and model judges cannot remove these gates.
