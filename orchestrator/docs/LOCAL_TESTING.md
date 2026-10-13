# Coordinator checks

Current stub checks, run from the repository root:

```sh
pnpm --dir orchestrator build
pnpm --dir orchestrator type-check
```

There is no coordinator test suite or running worker yet. Compilation does not
establish workflow acceptance.

Before #676 behavior, define fixtures for bounded child tasks, source-linked
handoffs, denied authority, private-context isolation, stale approvals, missing
inputs, child failures, cancellation and restart/resume. Required fixture checks
must run without live provider keys. Record protocol/config versions and the
chosen adapter's persistence limitations.

The [MVP ledger](../../docs/mvp-release-plan.md) requires standalone Geologist
and Research Analyst acceptance first. Human professional acceptance remains a
separate release gate.
