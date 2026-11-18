# Integrate Market Analyst

Install the declared Python employee and shared contract, context/model, MCP and
evaluation packages. Set the protected backend endpoint and owner-private MCP
credential-file reference. The installed client uses MCP 2026-07-28, fresh tool
discovery, validated arguments/results and bounded one-command requests.

For ordinary ADK interaction, use the configured root app from the README.
For durable employee work, a trusted host constructs a scoped `ContextCatalog`
with the task, policy, retention, current grants and source-authority callback,
then opens `MarketAnalystRuntime.open(catalog, model_config, backend_config=...)`.
The source callback revalidates through `get_context_source_metadata`; it must not
accept the model's source or permission assertions. Retain only validated common
contracts under the current employee/customer/asset/task namespace.

`review_context` captures the exact work reference and permitted evidence.
`prepare_market_review` re-drafts from current backend sources before binding this
context. `record_review` retains an awaiting-review reference without an approval
grant. `ReviewSupervisor` reads the durable backend checkpoint and resumes only an
approved exact `record_market_scenarios` operation. The human uses the separate
[backend review CLI](../../../servers/market/docs/EMPLOYEE_WORKFLOW.md).

The host that observed execution supplies actual events, final response, source
artifacts and dispatch observations to `app.evaluation.grade_case`. The grader
parses final text; a backend witness cannot substitute for changed employee
output. The private qualification runner derives current source inputs from the
inspected packet's bytes and compares the exact returned work/scenario.

The optional advisory tools retain null/unavailable fields, observation periods,
source identities, explicit assumptions and unreviewed interpretations. Use the
backend's configured synthesis profile for model-assisted queries. They do not
replace the employee task's bound scenario sources.

A compatible external MCP service may implement these tool schemas. Transport
compatibility does not attest that service's source rights, human authority or
professional correctness. An orchestrator consumes the employee's declared task,
work, context and review contracts; it must not read another employee's private
catalog or recreate the reasoning loop.
