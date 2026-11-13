# @shaleyeah/orchestrator

This package is a stub for optional coordination. Its only export is
`ORCHESTRATOR_VERSION = "0.1.0"`; it has no workflow, employee endpoint or deal
analysis client.

The accepted [architecture decision](../docs/adr/0001-durable-employee-contracts.md)
keeps every employee independently useful. The [Chief of Staff charter](../docs/chief-of-staff-role.md)
defines delegation, context and human decisions, with Investment Chair separate
for advisory investment analysis. #676 replaces this stub with one bounded
Geologist/Research Analyst diligence and corrected-input review workflow in
this unit, using ADK/Python as the preferred adapter. Temporal is an optional
future adapter. No coordination or authority gate is implemented today.

From the repository root, compile and check the existing stub:

```sh
pnpm --dir orchestrator build
pnpm --dir orchestrator type-check
```

Build output goes to `orchestrator/dist/`. These checks establish compilation,
not coordination or professional workflow acceptance.

See [architecture](docs/ARCHITECTURE.md), [development](docs/DEVELOPMENT.md),
[integration](docs/INTEGRATION.md), [deployment](docs/DEPLOYMENT.md),
[local checks](docs/LOCAL_TESTING.md) and [workflow scope](docs/HOW_IT_WORKS.md).
