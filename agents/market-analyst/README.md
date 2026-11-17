# Market Analyst

Mercatus Analyticus helps a commercial owner compare dated benchmark and regional
realized prices, inspect unit conversions and prepare explicit price scenarios.
All calculations come from the separate [Market MCP backend](../../servers/market).
Missing or stale inputs remain gaps. Future scenario prices remain assumptions.

The agent uses **Stand-alone Agent with Progressive Disclosure (Skills)**: one
native ADK agent requests bounded source detail and backend tools as needed.
The enrolled human reviews the exact sources, assumptions and scenario packet
before it can be recorded privately. Recording supplies no trading, contract,
bid or capital authority.

## Install and configure

From this package:

```sh
uv sync --locked
agents-cli info
```

Set `MARKET_ANALYST_MODEL_CONFIG_FILE` to an owned private model-profile JSON
file using the [shared provider contract](../../sdk/employee/README.md).
Agent, synthesis and optional judge profiles declare their owner, pinned provider
model/revision, credential-file references and request limits. Model keys stay
outside prompts and retained context. There is no implicit latest-model fallback.

Start the backend using its [deployment guide](../../servers/market/docs/DEPLOYMENT.md).
Set `MARKET_MCP_URL` and `MARKET_MCP_ACCESS_TOKEN_FILE` to its protected HTTP
endpoint and an owned 0600 token file. Remote endpoints require HTTPS; local HTTP
is limited to loopback. The Python client uses MCP 2026-07-28 with fresh discovery,
schema validation and bounded requests.

```sh
MARKET_ANALYST_MODEL_CONFIG_FILE=/absolute/private/models.json \
MARKET_MCP_URL=http://localhost:3007/mcp \
MARKET_MCP_ACCESS_TOKEN_FILE=/absolute/private/mcp-token \
agents-cli run "Inspect the assigned market task and prepare its dated scenarios for human review"
```

Ordinary ADK chat exposes the role tools. For durable employee work, the trusted
host opens `MarketAnalystRuntime` with a scoped `ContextCatalog`, current task,
source authorization and retention policy; see [integration](docs/INTEGRATION.md).
A chat history or model-supplied context is insufficient for protected review.

## Workflow and tools

| Tool | Purpose |
| --- | --- |
| `read_market_inputs` | Discover the authorized mandate, source revisions, series metadata and scenario inventory |
| `read_market_source` | Read bounded exact source pages |
| `get_context_source_metadata` | Recheck current source read/export authority |
| `calculate_market_scenarios` | Inspect period alignment, applicable gas conversion and scenario arithmetic |
| `draft_market_scenario` | Submit an interpretation and references; receive canonical unreviewed work and market objects |
| `prepare_market_review` | Bind exact work to current retained context and a separate human review packet |
| `market_review_status` | Read current review state after revision or restart |
| `record_market_scenarios` | Record only the exact currently qualified, human-approved private packet |
| `analyze_market_conditions` | Query dated benchmark observations and optional unreviewed interpretation |
| `competitive_market_analysis` | Query permitted company metrics through backend `competitive_analysis` |

The successful final response contains exactly `work` and `market`, copied from
the latest successful draft. An inaccessible input produces an explicit deferral.
Native tool confirmation cannot grant human approval. A changed source, task,
permission or reviewed assumption invalidates earlier continuation.

## Verify

```sh
uv run --locked ruff check app tests
uv run --locked pytest -q --cov=app --cov-fail-under=90
uv run --locked python tests/eval/run_fixture_evals.py --output /private/tmp/NEW-market-fixtures.json
```

The [evaluation guide](docs/EVALUATIONS.md) explains the configurable scorecard,
frozen references, actual-output grading and installed qualification. The full
native HTTP journey and independent package/container checks are required by the
owning CI job. Fictional prices and scripted provider responses establish
technical boundaries; they do not establish live-model quality, commercial
accuracy, vendor entitlement or final human MVP acceptance.

See [architecture](docs/ARCHITECTURE.md), [local testing](docs/LOCAL_TESTING.md),
[development](docs/DEVELOPMENT.md) and [deployment](docs/DEPLOYMENT.md).
