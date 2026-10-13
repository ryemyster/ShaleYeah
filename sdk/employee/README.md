# Employee runtime helpers

This Python package provides reusable state, provider and native ADK adapters for
independent SHALE YEAH employees. It imports no employee brain or matching tool
server. Each role supplies its own agent factory, source/review authority,
credential resolver and MCP endpoint.

The declared MCP client 0.3.0 pins the stateless 2026-07-28 profile. Connection
changes preserve scoped employee context and exact human-review records;
transport metadata or interrupted tool calls cannot create approval.

`context.ContextCatalog` stores private scoped tasks, evidence, drafts and pending
review references. Current authority is checked before reading or writing;
restoration preserves retention and cannot resurrect newly denied source data.
`models` contains the qualified configurable Gemini/Anthropic native adapters.
`events.EmployeeEvents` emits correlated metadata with exact record bindings.
`native.EmployeeRuntime` uses ADK's runner and durable session service.

An ADK role factory must disable implicit old conversation contents and bind
the supplied context selection, tool capture and sealed dispatch callbacks.
The runtime rejects incomplete factories before model dispatch. The host owns
the role, endpoint, identity and policy; model text cannot change them. Each
employee scans its own credentials and rejects configured credential references.
Remote tool/judge keys stay with their respective actors.

## Install and test

From this directory in the authoring workspace:

```sh
uv sync --locked --extra adk
uv run --locked --extra adk ruff check .
uv run --locked --extra adk pytest -q
uv build --wheel
```

The `adk` extra selects the pinned native runtime/provider dependencies. Import
the context helper without that extra when no native agent adapter is needed.
For independent installation, install this wheel with its declared first-party
contract, MCP-client and evaluation wheels. Authoring `tool.uv.sources` paths
are conveniences; installed wheels do not use those paths.

The library does not create approvals, select a model, provision a cloud target,
publish a report or promote unreviewed output. Current rights, reviewed sharing
and protected actions require trusted executing adapters. Fixture/native
regressions prove technical boundaries; professional output acceptance remains
with each role's evaluation and human workflow.
