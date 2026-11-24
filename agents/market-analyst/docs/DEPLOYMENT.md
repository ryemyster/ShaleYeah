# Deploy Market Analyst

Market Analyst runs in an installed Python environment with the separate Market
MCP backend. Local processes, containers and hosted runtimes can supply the same
contracts. No orchestrator, cloud account or vector database is mandatory.

The operator supplies a pinned model configuration, private credential references,
MCP endpoint/token, task and source-authority integration, context storage,
retention, and required event sink. Configure `MARKET_ANALYST_MODEL_CONFIG_FILE`
and optional `MARKET_ANALYST_EVENT_CONFIG_FILE` for the root app. MCP settings are
`MARKET_MCP_URL`, `MARKET_MCP_ACCESS_TOKEN_FILE`, and optional bounded
`MARKET_MCP_TIMEOUT_SECONDS` / `MARKET_MCP_REQUEST_TIMEOUT_SECONDS` (30/10 seconds
by default, at most 120). Remote MCP requires HTTPS.

Durable operation uses the trusted host's `MarketAnalystRuntime` integration;
ordinary ADK chat does not configure that storage or authority for the operator.
Mount only the employee's permitted context and credential files. The employee
must not have the human review settings, qualification-policy write access or the
backend's private review store.

`Dockerfile` consumes the independent extraction bundle and installs declared
wheels and locked requirements as a non-root image. The backend has its own image
and an evaluation-only environment without the employee app. The container
qualification repeats the source/context/qualified-human-review/restart journey.
Run those checks against the intended artifact and environment before deployment;
this package makes no production deployment or vendor-entitlement claim.

See [local testing](LOCAL_TESTING.md), the [evaluation guide](EVALUATIONS.md) and
the backend's [deployment guide](../../../servers/market/docs/DEPLOYMENT.md).
