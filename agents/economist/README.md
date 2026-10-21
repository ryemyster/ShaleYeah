# Economist employee

Caesar Augustus Economicus helps an economist compare financial scenarios from
reviewed forecasts and explicit assumptions. It retains source revisions,
net ownership, taxes/royalties, currency, timing and uncertainty so a human can
review the actual basis behind the numbers.

The employee uses Google's Agent Development Kit (ADK) for Python. Its mode is
**Stand-alone Agent with Progressive Disclosure (Skills)**: one specialist loads
bounded evidence when needed. It calls a separately configured
[Econobot tool server](../../servers/econobot/README.md) through MCP (Model Context
Protocol). Other compatible agents can use that same server; this employee can
use a compatible external MCP implementation.

## Run and configure

From this directory:

```sh
uv sync --locked
agents-cli info
export ECONOMIST_MODEL_CONFIG_FILE=/absolute/private/models.json
export ECONOBOT_MCP_URL=http://127.0.0.1:3002/mcp
export ECONOBOT_MCP_ACCESS_TOKEN_FILE=/absolute/private/tool-token
agents-cli run
```

The private model file selects provider/model, revision, credential references
and limits for each purpose. See [provider configuration](../../docs/model-providers.md).
Gemini and Anthropic are explicit choices, with separate agent, optional synthesis
and judge credentials. Tool access uses its own private credential. Files must
belong to the operating user with mode `0600`; keep them outside the checkout.

For retained work, the host opens `EconomistRuntime` with its own `ContextCatalog`,
current source/context authority and model settings. The runtime restores this
employee's exact task, evidence, work and pending-review references after restart.
The CLI is an authoring interface; the scoped runtime and executing review backend
provide the durable employee workflow. See [integration](docs/INTEGRATION.md).

## Work and human decisions

The employee may retrieve permitted inputs, calculate and compare explicit net
cash-flow scenarios, and prepare a source-linked review packet. The final analysis
is canonical JSON containing `work` and `scenario`; missing authorized inputs
produce a `deferred` reason. Net present value (NPV) discounts future money to
its present value. Internal rate of return (IRR) is the rate at which NPV is zero.
Unavailable or ambiguous results stay unavailable with a reason.

A separately enrolled human inspects all inputs and approves, rejects or requests
changes to the exact scenario revision. The backend rechecks current source
rights, qualification and the bound review before saving a private scenario.
Restart and repeated continuation cannot create a second save. Native tool
confirmation is an interaction pause; it does not grant business authority.
No capital commitment, bid submission, external publication or reserves/fiscal
certification is supported.

## Check and build

```sh
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
uv run --locked python tests/eval/run_fixture_evals.py \
  --output artifacts/evals/economist.json --code-revision "$(git rev-parse HEAD)"
uv build --wheel
```

Tune the [performance profile](tests/eval/performance_profile.json),
[case dataset](tests/eval/datasets/economist-performance.json) and approved optional
rubrics through configuration. Required financial, source and authority gates
cannot be removed by configuration or a model judge. The
[evaluation guide](docs/EVALUATIONS.md) explains initial research labels and their
limits. Offline fixtures do not measure professional accuracy or time saved.

See [architecture](docs/ARCHITECTURE.md), [development](docs/DEVELOPMENT.md),
[local tests](docs/LOCAL_TESTING.md), [workflow](docs/HOW_IT_WORKS.md) and
[deployment](docs/DEPLOYMENT.md).
