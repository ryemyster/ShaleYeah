# Integrate Title Analyst

Install this Python package and its declared contract, evaluation, MCP-client and employee-runtime dependencies. Select the backend with `TITLE_MCP_URL`, and resolve its separate credential through `TITLE_MCP_ACCESS_TOKEN_FILE`. The default URL is loopback port 3010. Use HTTPS remotely; the role configuration helper permits HTTP on loopback. The backend must have current source/task/actor configuration.

`create_title_analyst_agent` accepts explicit backend/model configuration, credential resolution, events and context hooks. Tools accept task/instrument/source IDs and revisions rather than county-based estimates or file paths. Completed output is exactly `work` plus `title`; unavailable authority produces a JSON deferral.

For retained execution, open the installed `ContextCatalog` with customer/asset/task/employee scope, the authenticated principal, private directory, retention/budget policy, and current grant/source-authority callbacks. Seed the exact task and authorized source-artifact metadata, then call `await TitleAnalystRuntime.open(catalog, models, backend_config=backend, ...)`. Use `await runtime.run(prompt)` and close the runtime when finished. Callbacks must revalidate current read/export rights; a stored source identity alone supplies no access.

Successful role calls retain permitted metadata through catalog guards. Before preparing review, the adapter redrafts and compares canonical work/title, obtains host-owned context and retains only the pending review reference. Human grants are not stored as agent knowledge. The shared review supervisor resumes the exact approved private-record transition without another model decision.

A compatible external MCP service can replace the backend if it preserves the same source, argument, receipt, error and authority contract. The external fixture checks transport/tool substitution; it does not certify that service's title correctness or review implementation. See the backend [tool/review contract](../../../servers/title/docs/INTEGRATION.md).
