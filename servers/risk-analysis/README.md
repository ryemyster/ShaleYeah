# Risk Analysis MCP backend
Risk Analysis checks declared joint downside scenarios against an operator's risk policy. It is an independent TypeScript MCP (Model Context Protocol) server, paired with the [Risk Analyst employee](../../agents/risk-analyst/README.md).

It reads three exact operator JSON exports, calculates loss summaries and dependence from complete joint states, preserves policy blockers and enforces enrolled human review before a private record. The calculator needs no model key. Professional calibration and consequential decisions remain human owned.

## Build and verify
From this directory with the locked workspace dependencies:
```sh
pnpm build
pnpm type-check
pnpm lint
pnpm test
```
The suite starts local fixture listeners and uses the separately installed Risk Analyst runtime. Follow [local testing](docs/LOCAL_TESTING.md) to install it first. Tests cover current sources, arithmetic, policy, actual native output, independent clients and protected human review.

## Configure sources and authority
Set `RISK_ANALYSIS_CONFIG_FILE` to an owner-only private binding with the task, three exact source envelopes/files, current read/export grant, scanner references, audit path and review policy. See [input contract](docs/INPUTS.md) and [integration](docs/INTEGRATION.md). Starting without a binding exposes no analysis tools.

`pnpm start` runs compiled stdio. The explicit loopback HTTP example uses `RISK_ANALYSIS_HTTP_CONFIG_FILE` and `node examples/local-http.mjs`; it additionally requires a private access-token file and event configuration. Setting a port alone grants no access.

## Tools
| Tool | Purpose |
| --- | --- |
| `read_risk_inputs` | Discover permitted register, policy, scenario models and exact source identities |
| `read_risk_source` | Read bounded source detail |
| `get_context_source_metadata` | Revalidate source access without returning text |
| `calculate_risk` | Calculate one exact joint model |
| `compare_risk_scenarios` | Compare explicit model revisions |
| `draft_risk` | Derive canonical unreviewed work and risk packet |
| `prepare_risk_review` | Persist the exact proposed review revision |
| `risk_review_status` | Read its durable scoped checkpoint |
| `record_risk_assessment` | Record the currently qualified human-approved private appraisal once |

Human inspection and decisions are separate API/CLI operations. The employee cannot approve, relax policy, choose a write path, certify compliance or commit capital. See [architecture](docs/ARCHITECTURE.md), [method](docs/HOW_IT_WORKS.md) and [deployment](docs/DEPLOYMENT.md).
