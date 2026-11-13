# Legal MCP backend

Legal validates source-cited requirement/exception memos for an enrolled human reviewer. It is an independent TypeScript MCP (Model Context Protocol) server paired with the [Legal Analyst employee](../../agents/legal-analyst/README.md).

It reads three exact operator JSON exports, validates citations and declared applicability, preserves missing inputs/conflicts and enforces human review before a private advisory record. The backend needs no model key. The employee proposes the analysis; legal interpretation and consequential decisions remain human owned.

## Build and verify

From this directory with locked workspace dependencies:

```sh
pnpm build
pnpm type-check
pnpm lint
pnpm test
```

Tests exercise actual operator files, source permissions, Unicode citations, dates/scope, review/restart/replay/revocation, a separate human CLI and a generic stdio MCP client. See [local testing](docs/LOCAL_TESTING.md).

## Configure and run

Set `LEGAL_CONFIG_FILE` to an owner-only private binding containing the task, three exact source envelopes/files, current read/export grant, secret-scanner references, private audit path and review policy. See [inputs](docs/INPUTS.md) and [integration](docs/INTEGRATION.md).

`pnpm start` runs the compiled stdio entry. Starting without a binding exposes no analysis tools. An HTTP host must explicitly configure the installed SDK's identity/scope, credential and audit boundaries; setting a port alone grants no access.

## Tools

| Tool | Purpose |
| --- | --- |
| `read_legal_inputs` | Discover exact permitted matter, source revisions and checklist |
| `read_legal_source` | Read a bounded exact JSON source export |
| `read_legal_provision` | Read a versioned provision and declared applicability |
| `cite_legal_source` | Compute an exact quote's UTF-8 byte spans and SHA-256 |
| `get_context_source_metadata` | Revalidate read/export rights without returning text |
| `compare_legal_sources` | Compare selected source kinds and applicability assertions |
| `draft_legal_memo` | Validate proposed issues and derive canonical unreviewed work |
| `prepare_legal_review` | Persist an exact private memo/work/context/evaluation revision |
| `legal_review_status` | Read its current scoped checkpoint |
| `record_legal_memo` | Record the currently qualified human-approved private memo once |

Human inspection and decisions are separate API/CLI operations. Recording grants no legal clearance, professional certification, contract/redline approval, signature, filing, waiver, settlement or capital authority. See [architecture](docs/ARCHITECTURE.md), [method](docs/HOW_IT_WORKS.md) and [deployment](docs/DEPLOYMENT.md).
