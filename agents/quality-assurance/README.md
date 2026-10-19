# Quality-assurance employee

Testius Validatus helps a data professional find defects in oil-and-gas inputs,
explain the evidence and prepare the next review decision. A failed data check
is useful work: the employee must report it accurately instead of making the
input look acceptable.

This is a native Python agent built with Google's Agent Development Kit (ADK).
Its architecture is **Stand-alone Agent with Progressive Disclosure (Skills)**.
It calls an independently configured [QA MCP server](../../servers/qa-server/README.md),
which runs approved rules and records their actual results. MCP means Model
Context Protocol: other compatible agents can use the same backend.

## Run and configure

From this directory:

```bash
uv sync --locked
agents-cli info
export QA_EMPLOYEE_MODEL_CONFIG_FILE=/absolute/private/models.json
export QA_SERVER_MCP_URL=http://127.0.0.1:3004/mcp
export QA_SERVER_MCP_ACCESS_TOKEN_FILE=/absolute/private/qa-token
agents-cli run
```

The private model file selects this employee's agent, optional synthesis and
judge profiles. See [model configuration](../../docs/model-providers.md).
Each purpose has its own provider/model, owner, credential reference and limits.
A compatible external MCP endpoint can replace the bundled server. Remote
connections require HTTPS; local HTTP needs the client’s explicit loopback setting.
Private credential files belong to the operating user and use mode `0600`.

`QARuntime.open(catalog, config, backend_config=...)` connects the native employee
to its own scoped context catalog. The host supplies current context and source
rights. Store exact task, source and work references, then a checkpoint with open
questions and pending review references. Restarting reloads those records rather
than adding an old conversation to every model request. See [architecture](docs/ARCHITECTURE.md).

## Human review

The employee may run the approved profile, read current authorized results and
propose a repair request, deferral or bounded exception. A separately authenticated
human reviews the exact packet through the server's operator interface. The backend
checks current evidence, task/profile revisions, qualification and a one-time grant
before recording the private disposition. Native tool confirmation grants no authority.

An accepted exception retains the original `FAIL` and its real defect counts.
`UNTESTED` and `ERROR` remain unresolved; they cannot become accepted exceptions.
Source repair belongs to the producing owner and requires a new input revision and
new checks. This employee does not certify reserves or approve an organizational release.

## Check and build

```bash
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
uv run --locked python tests/eval/run_fixture_evals.py \
  --output artifacts/evals/qa.json --code-revision "$(git rev-parse HEAD)"
uv build --wheel
```

Edit [the performance profile](tests/eval/performance_profile.json) and
[case dataset](tests/eval/datasets/qa-performance.json) to tune job evaluations;
update their content hashes together. Trusted schema, evidence, authority,
architecture and observed-result gates cannot be removed by configuration or a
model judge. Data-rule configuration is separate from employee-performance grading.
The [starter-label notes](docs/EVALUATIONS.md) explain the provisional research
basis and limits. Offline fixtures establish repeatable controls, not field accuracy.

The [deployment guide](docs/DEPLOYMENT.md) covers installation, source hooks and
separate containers. The [role charter](docs/ROLE.md) explains QA's responsibilities.
