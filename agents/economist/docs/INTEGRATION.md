# Integrating the Economist

Install the employee wheel with its declared contract, evaluation, MCP-client
and employee-runtime wheels. `tool.uv.sources` paths are workspace authoring
conveniences. The extraction checker replaces them with declared wheel references
and generates an independent source lock.

The host creates a private `ContextCatalog` for the exact customer, asset, task
and employee. Supply a current context grant provider and a source-authority
adapter that calls the backend's `get_context_source_metadata` for the requested
read/export operation. Validate the returned exact evidence, operation and scope;
failed or revoked metadata must deny access. Put the assigned task and permitted
source artifacts in the catalog before creating its initial checkpoint.

Open `EconomistRuntime.open(catalog, models, backend_config=connection, events=events)`
and call `await runtime.run(prompt)`. Close it with `await runtime.close()`.
The installed runtime owns native ADK sessions and bounded dispatch. Its source
callback stores all financial evidence from successful tool responses. Work and
pending review references survive process restart; human approval grants do not
become agent memory. Host authorities must remain current across restart.

The connection is an installed `MCPClientConfig`, or is loaded from
`ECONOBOT_MCP_URL` and `ECONOBOT_MCP_ACCESS_TOKEN_FILE`. Remote services use HTTPS;
local HTTP requires the explicit loopback option. A compatible external MCP
service can implement the same role tools without importing this employee.
BYO model credentials and BYO external agents are separate choices.

Econobot accepts a canonical task with seven exact financial source references,
explicit scenario revisions and current read/export grants. See
[employee inputs](../../../servers/econobot/docs/EMPLOYEE_INPUTS.md) for its private
operator export contract. Other agents can call those tools directly through a
compatible MCP client. Host configuration and enrolled human decisions are never
model-facing tools.

After the separate reviewer approves an exactly qualified packet,
`ReviewSupervisor(connection, client=audited_client).resume(review_id)` reads the
current backend state and executes only the permitted transition. The host clears
the completed pending-review reference in the catalog; retain task/work references.
The [native fixture](../tests/fixtures/context-step.py) demonstrates the full host
wiring with offline model responses. Its synthetic grants and models are test
inputs, not a production identity service or operator dataset.
