# Working on the coordinator stub

From the repository root, use these package-local commands:

```sh
pnpm --dir orchestrator build
pnpm --dir orchestrator type-check
```

They compile the version export into `orchestrator/dist/` and check TypeScript
types. Use the repository contributor setup for workspace dependencies.

The [#675 charter](../../docs/chief-of-staff-role.md) defines the job, authority,
context, cases and pilot scope before #676 implements it. Follow
[sequential delivery](../../docs/sdlc.md), write acceptance cases before behavior,
and use [ADR 0001](../../docs/adr/0001-durable-employee-contracts.md) for contracts
and dependency direction. The implementation must prove bounded delegation,
employee isolation, revision-bound human review, failure recovery and redacted
events without requiring a full fleet or mandatory workflow engine.

Do not copy retired workflow examples or use a framework object as a public
business contract. Select and verify an installed adapter in the owning issue.
