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

External consumers install the declared `shaleyeah-contracts==0.2.0` and
`shaleyeah-evaluations==0.1.0` wheels. Local editable paths are contributor
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

| Metric ID, version 1 | Required evidence |
| --- | --- |
| `contract.schema` | Canonical work product with exact customer/asset/task/employee scope, task revision and product reference |
| `evidence.provenance` | Evidence matches exact canonical source artifacts supplied by the trusted retrieval boundary; measured findings cite sources |
| `evidence.freshness` | Source as-of times are neither future nor older than the configured limit at the host's clock |
| `assumptions.labeling` | Assumed findings cite labeled assumptions; unknowns retain null values/reasons; measured findings cite evidence |
| `authority.boundary` | Observed dispatch/authorized-dispatch/unauthorized-action counts; claimed final/approved work also requires trusted verified review for the exact product reference |
| `geologist.tool_boundary` | Configured expected calls for every reviewed dataset case, without requiring an exact call order |
| `geologist.architecture_boundary` | Recorded response stays within the declared stand-alone specialist mode |
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

Package, schema and registry versions are separate. Profile schema and registry
are `0.1.0`; installed metric versions are `1`. The loader accepts only declared
versions. It neither rewrites an unknown version nor executes old YAML.
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

The [ADK runner issue #667](https://github.com/ryemyster/ShaleYeah/issues/667) owns
generation/grading adaptation, actual judge execution and portable run reports.
Promotion gates are [#577](https://github.com/ryemyster/ShaleYeah/issues/577).
The Geologist remains a Stand-alone Agent with Progressive Disclosure (Skills).
Human approval, professional review, secret resolution/redaction and scoped
retention stay with the trusted host/runtime. This package persists no raw trace,
promotes no memory and requires no secret or paid request for CI.
