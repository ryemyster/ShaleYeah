# Integration contract

Use the pinned MCP 2026-07-28 profile and the full request in the
[README](../README.md). Tool names stay calculate_dcf, analyze_economics and
sensitivity_analysis; their input/output shapes now require explicit periodic
cash-flow data.

calculate_dcf returns metric objects, not bare numeric IRR/payback scalars.
The IRR is a decimal per declared period; payback counts period ends.
Every unavailable metric has null value and a reason. A successful MCP response
means the calculation executed, not that every metric exists or a human
approved the investment.

analyze_economics accepts a complete input contract and optionally requests
separate unreviewed interpretation. sensitivity_analysis accepts explicit
scenario contracts in the same period/currency, with unique scenario IDs.
Legacy filePath/dataType, inferred prices/costs/production, arbitrary outputPath
and variance-generated scenarios are rejected. The tools do not read or write
caller-selected files.

The current Economist TypeScript delegation surface is historical; its full
contract adoption is issue 680. Callers must update request shapes rather than
supply silent defaults. Source integrations prepare reviewed cash-flow revisions
outside this calculator. References identify those revisions but do not
substitute for current source rights or actual human approval.

For HTTP, the embedding host provides identity, scopes and audit using the
[SDK access contract](../../../sdk/docs/http-access.md). Employee context,
qualification, exact human review and restart-safe approved continuation remain
the responsibility of the independently deployed employee and its executing
backend, to be adopted in issue 680.
