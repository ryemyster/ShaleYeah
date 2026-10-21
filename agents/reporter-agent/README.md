# Reporter employee

Scriptor Reporticus Maximus helps an oil-and-gas team turn reviewed specialist
work into a report for an explicit audience. It keeps numbers, units, assumptions,
missing evidence and source revisions visible so the owner can review the result.
It does not choose the investment decision or certify reserves.

The employee uses Google's Agent Development Kit (ADK) with Python. Its primary
architecture is **Stand-alone Agent with Progressive Disclosure (Skills)**.
It calls an independently configured Reporter-compatible Model Context Protocol
(MCP) service; MCP is the interface used to discover and call bounded tools.
The matching [Reporter server](../../servers/reporter/README.md) assembles reports
and enforces the durable human-review gate.

Private drafting requires current source rights. The human owner requests edits
or approves the exact qualified report revision before it enters the configured
private reviewed-reports destination. No external sending is implemented.

From this package directory:

```bash
uv sync --locked
uv run --locked pytest -q --cov=app --cov-fail-under=90
uv run --locked ruff check app tests
agents-cli info
```

These commands install declared dependencies, run local controls and inspect the
portable project. They do not contact a paid model or deploy a service. Python
3.11–3.13 is supported; CI uses Python 3.12.

Set `REPORTER_MODEL_CONFIG_FILE` to the private BYO model configuration and
`REPORTER_MCP_ACCESS_TOKEN_FILE` to a separate private MCP credential. Set
`REPORTER_MCP_URL` for an external compatible service. The default local address
is `http://127.0.0.1:3009/mcp`; a missing credential fails closed. Providers are
explicit profiles, with separate agent, synthesis and optional judge ownership.
See [provider setup](../../docs/model-providers.md) and
[integration](docs/INTEGRATION.md).

[Architecture](docs/ARCHITECTURE.md) explains context and review.
[Local testing](docs/LOCAL_TESTING.md) explains the configuration-based scorecard.
[Deployment](docs/DEPLOYMENT.md) states the supported execution limits.
