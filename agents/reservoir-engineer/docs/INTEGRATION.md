# Integrating the Reservoir Engineer

Install the employee wheel with its declared contract, evaluation, MCP-client
and employee-runtime dependencies. Workspace `tool.uv.sources` entries support
authoring; independent distributions resolve declared wheels instead of sibling
source trees.

The host creates a private `ContextCatalog` for the exact customer, asset, task
and employee. Supply a current context grant provider and a source-authority
adapter that calls `get_context_source_metadata` for the required read/export
operation. Verify exact evidence, operation and scope. Failed, expired or revoked
access must deny assembly and continuation.

Put the assigned task and permitted source artifacts in the catalog, create its
initial checkpoint, then open
`ReservoirEngineerRuntime.open(catalog, models, backend_config=connection, events=events)`.
Use `await runtime.run(prompt)` and close with `await runtime.close()`.
The role retains complete source identities from successful calls and binds
verified work to its own context before preparing review. Human approval grants
do not become agent memory.

`connection` is an installed `MCPClientConfig`, or is loaded from
`CURVE_SMITH_MCP_URL` and `CURVE_SMITH_MCP_ACCESS_TOKEN_FILE`. Remote services use
HTTPS; local HTTP requires the explicit loopback option. Compatible external
tools can implement this role surface without importing the employee.

Curve-smith binds three exact inputs: production history, operating basis and
forecast assumptions. See its [input contract](../../../servers/curve-smith/docs/EMPLOYEE_INPUTS.md).
The default adapter reads private operator exports. An installed normalized
public/internal snapshot hook is separate from vendor-native API qualification
and redistribution rights. BYO model credentials and BYO external employees are
separate conformance choices.

After a separate human approves an exactly qualified packet,
`ReviewSupervisor(connection, client=audited_client).resume(review_id)` reads the
current review and executes only its bound transition. The host clears the
completed pending-review reference while retaining task/work references. The
[native fixture](../tests/fixtures/context-step.py) shows full host wiring through
protected HTTP using offline provider responses; its grants and data are synthetic.
