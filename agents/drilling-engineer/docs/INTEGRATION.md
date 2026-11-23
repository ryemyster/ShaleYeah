# Integrate Drilling Engineer

Install this package and its declared contract, evaluation, MCP-client and employee-runtime dependencies. Select the backend with `DRILLING_MCP_URL` and its separate credential through `DRILLING_MCP_ACCESS_TOKEN_FILE`. The default URL is loopback port 3003; use HTTPS remotely. The backend needs current task/source/actor configuration.

`create_drilling_engineer_agent` accepts explicit model/backend configuration, credential resolution, events and context hooks. Tools accept exact task/source/evidence IDs and revisions. Completed output is exactly `work` plus `drilling`; unavailable authority produces a JSON deferral.

For durable execution, open the installed ContextCatalog with customer/asset/task/employee scope, authenticated principal, private directory, retention/budget policy and current grant/source-authority callbacks. Seed the exact task and authorized source-artifact metadata, then call `await DrillingEngineerRuntime.open(catalog, models, backend_config=backend, ...)`. Execute `await runtime.run(prompt)` and close when finished. A stored source identity supplies no current access by itself.

The role verifies current canonical work before retaining review context. Human grants stay outside agent knowledge. The shared ReviewSupervisor resumes the exact approved private-record transition without another model decision. A compatible external MCP may replace the backend if it preserves argument, source, receipt, error and authority contracts; a transport fixture alone does not certify that implementation's engineering correctness. See the [backend contract](../../../servers/drilling/docs/INTEGRATION.md).
