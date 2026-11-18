# Integrating Legal Analyst

Use `create_legal_analyst_agent` for an embedded ADK agent, passing explicit model configuration, MCP connection, event emitter and optional context hooks. Use `LegalAnalystRuntime.open(catalog, config, ...)` for retained working context, fresh source authorization before model dispatch, exact review references and restart behavior. Shared helpers are installed dependencies; runtime code does not import another employee's source.

Set `LEGAL_MCP_URL` and `LEGAL_MCP_ACCESS_TOKEN_FILE` for the independent Legal-compatible MCP service. The installed client validates the selected MCP profile, resolves private credentials at dispatch, preserves safe failures and emits correlated events. Keep customer/asset/task/principal authorization in the host/backend. Tool arguments cannot choose credentials, principals, URLs or output paths.

The ten backend tools are documented in the [Legal backend](../../../servers/legal/README.md). Python proposal and comparison tools take bounded JSON strings so both native provider adapters receive fixed argument schemas. Quote lookup returns the exact citation object to copy into the proposal.

`prepare_legal_review` verifies fresh canonical `work`/`legal` before retaining host-owned context. It preserves a pending review reference without persisting an approval grant in employee context. `ReviewSupervisor` maps shared review continuation to `legal_review_status` and `record_legal_memo`; the executing backend still enforces current human authority and qualification.

Human decisions use the separate [backend API/CLI](../../../servers/legal/docs/INTEGRATION.md). A compatible service must preserve these source, revision, privacy and human-review contracts. Semantic/professional correctness and vendor access need separate qualification.
