# @shaleyeah/orchestrator

This package is a stub for optional coordination. Its only export is
`ORCHESTRATOR_VERSION = "0.1.0"`; it has no workflow, employee endpoint or deal
analysis client.

The accepted [architecture decision](../docs/adr/0001-durable-employee-contracts.md)
keeps every employee independently useful. #675 defines Chief of Staff authority
and its relationship to Investment Chair; #676 implements one bounded Geologist
and Research Analyst diligence workflow. Those issues select the coordinator
implementation and package location. Temporal is an optional future adapter.

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
