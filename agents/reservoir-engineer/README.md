# Reservoir Engineer employee

Lucius Technicus Engineer helps a reservoir engineer reconcile production evidence
and compare declared decline-curve alternatives. It preserves well/completion
identities, operating assumptions, source revisions, units, history coverage and
observed diagnostics for human review.

The employee uses Google's Agent Development Kit (ADK) for Python. Its mode is
**Stand-alone Agent with Progressive Disclosure (Skills)**: one specialist loads
bounded evidence when needed. It calls the independently runnable
[Curve-smith MCP server](../../servers/curve-smith/README.md). Compatible external
MCP implementations can supply the same tools.

## Run and configure

From this directory:

```sh
uv sync --locked
agents-cli info
export RESERVOIR_ENGINEER_MODEL_CONFIG_FILE=/absolute/private/models.json
export CURVE_SMITH_MCP_URL=http://127.0.0.1:3004/mcp
export CURVE_SMITH_MCP_ACCESS_TOKEN_FILE=/absolute/private/tool-token
agents-cli run
```

The private model file selects provider/model revisions, credential references
and limits for each purpose. See [provider configuration](../../docs/model-providers.md).
Agent, optional synthesis and judge credentials are separate from tool access.
Private files belong to the operating user and use mode `0600`.

For durable work, the host opens `ReservoirEngineerRuntime` with a private
`ContextCatalog`, current context/source authorities, model configuration and
MCP connection. Task, evidence, work and pending-review references survive
restart. The CLI is an authoring entrypoint; the retained runtime and executing
backend supply the durable workflow. See [integration](docs/INTEGRATION.md).

## Work and human decisions

The employee may read permitted production inputs, compare fixed-b Arps
alternatives, calculate finite modeled and future-only volumes, and draft a
source-linked review packet. b is a declared assumption. Training and held-out
observations remain separate; fit statistics and history counts are observed,
and uncertainty remains unavailable without a calibrated model. Missing, stale,
conflicting or unsupported inputs must be surfaced. Annual totals, lease totals,
period volumes and instantaneous daily rates are distinct inputs.

The final analysis is canonical JSON containing `work` and `forecast`; unavailable
authorized inputs produce a `deferred` reason. A separately enrolled human
inspects the exact sources, assumptions, work, context and evaluation revisions,
then approves, rejects or requests changes. The backend rechecks source rights,
installed qualification and exact review before an idempotent private save.
Native confirmation cannot grant that approval. Reserves certification, field
operation, capital commitment and external publication are unsupported.

## Check and build

```sh
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
uv run --locked python tests/eval/run_fixture_evals.py --output artifacts/evals/reservoir.json --code-revision "$(git rev-parse HEAD)"
uv build --wheel
```

The [performance profile](tests/eval/performance_profile.json) configures freshness,
numerical tolerances and expected tool usage over a hash-bound
[dataset](tests/eval/datasets/reservoir-performance.json). Mandatory numerical,
source and authority gates cannot be removed or overridden by a model judge.
The initial synthetic labels are provisional technical controls; they do not
measure field accuracy, professional correctness or time saved.

See [architecture](docs/ARCHITECTURE.md), [development](docs/DEVELOPMENT.md),
[local testing](docs/LOCAL_TESTING.md), [evaluations](docs/EVALUATIONS.md),
[workflow](docs/HOW_IT_WORKS.md) and [deployment](docs/DEPLOYMENT.md).
