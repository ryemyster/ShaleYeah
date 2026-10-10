# @shaleyeah/quality-assurance

Testius Validatus helps a quality-assurance (QA) or data professional find and
review defects in oil-and-gas inputs and analysis products.

The [employee charter](docs/ROLE.md) defines its job, own context, configurable
rules, source hooks, evaluation cases and human decisions. The current runtime
wraps two qa-server tools through MCP (Model Context Protocol), with reasoning
and human-in-the-loop (HITL) settings. Its existing configuration-based assessments
are not observed data-quality checks. [Issue #716](https://github.com/ryemyster/ShaleYeah/issues/716)
implements those checks; [#542](https://github.com/ryemyster/ShaleYeah/issues/542)
implements the charter in the independently runnable ADK/Python employee.

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
