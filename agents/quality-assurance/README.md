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
