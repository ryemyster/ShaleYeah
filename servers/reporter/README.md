# Reporter tool service

Reporter turns currently permitted reviewed specialist work into a private report.
It preserves literal numbers, units, assumptions, unknowns, conflicts and source
revisions. It presents supplied conclusions; it does not decide whether to invest.

This TypeScript service exposes Model Context Protocol (MCP) tools. Any compatible
client can use it; the [Reporter employee](../../agents/reporter-agent/README.md)
is one independent client. The service enforces source authority and human review
at the executing boundary.

From this package directory:

```bash
pnpm build
pnpm test
pnpm lint
pnpm start
```

Build the declared shared dependencies first in a checkout. `pnpm start` launches
stdio MCP. Without a private `REPORTER_CONFIG_FILE`, discovery remains available
and role operations fail closed. The config supplies the exact task, owner,
audience/template/disclosures, private review store and current source receipts.
Owner-only local exports are operator attestations of origin review and sharing;
remote hosts can inject their authenticated artifact authority instead.

The tools are `get_reporter_status`, `get_reviewed_source`, `get_context_source_metadata`, `draft_report`,
`get_model_profile`, `synthesize_report`, `prepare_review`, `get_review_status`
and `release_report`. Synthesis requires an explicit separately owned BYO model;
its note remains unreviewed and cannot modify the publication. No default model
fallback, arbitrary output path, external send or professional certification is
implemented.

The human owner requests changes or approves the exact qualified report through
a separate trusted operator interface. Private release is idempotent and checks
current source rights, context, task, report and qualification again after restart.
See [architecture](docs/ARCHITECTURE.md), [integration](docs/INTEGRATION.md) and
[testing](docs/LOCAL_TESTING.md) for the interfaces and fixture limits.
