# @shaleyeah/quality-assurance

Testius Validatus helps a quality-assurance (QA) or data professional find and
review defects in oil-and-gas inputs and analysis products.

The [employee charter](docs/ROLE.md) defines its job, own context, configurable
rules, source hooks, evaluation cases and human decisions. The current runtime
has not yet adopted the observed server's exact task/profile/result references.
Use the [QA server](../../servers/qa-server/README.md) directly for current
configured data checks and recorded reports. It accepts independent clients
through MCP (Model Context Protocol). [Issue #542](https://github.com/ryemyster/ShaleYeah/issues/542)
completes the independently runnable ADK/Python employee, its context, configurable
evaluations and human review. The current TypeScript package's unit regressions
do not qualify that full employee workflow.

## Quick start

Run from `agents/quality-assurance` after the contributor setup in
[CONTRIBUTING.md](../../CONTRIBUTING.md). These commands run the current
TypeScript package while #542 owns its replacement.

```bash
pnpm start   # runs the agent's standalone runtime
```

## Building

```bash
pnpm build
pnpm test    # current package regressions; not professional QA qualification
```

## Environment

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Required for synthesis calls |
| `QA_SERVER_MCP_ACCESS_TOKEN_FILE` | Dedicated owner-readable MCP bearer file (mode `0600`); separate from the model key |

The configured QA backend URL must identify its `/mcp` endpoint; the retained
runtime's historical bare local URL is normalized to that route. Configure the
backend's explicit identity, scopes and audit sink through the
[HTTP access guide](../../sdk/docs/http-access.md). `PORT` alone is insufficient.
The connection uses the pinned stateless protocol, bounded discovery, a
30-second default deadline (maximum 120 seconds), a 1 MiB response limit and
no redirects. Genuine tool errors and uncertain failures after dispatch stop
automatic retry. Transport compatibility does not establish the employee's
observed QA workflow, which remains assigned to #542.
