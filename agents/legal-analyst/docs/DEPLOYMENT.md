# Deploying Legal Analyst

Build this Python unit independently with its locked installed dependencies and deploy it beside a separately authorized Legal-compatible MCP service. Local processes, containers and managed runtimes can supply the same contracts; no particular cloud or orchestrator is required.

Supply `LEGAL_ANALYST_MODEL_CONFIG_FILE` with explicit provider/model revisions, owner scope, credential references and budgets. Supply `LEGAL_MCP_URL` and `LEGAL_MCP_ACCESS_TOKEN_FILE` separately, and use `LEGAL_ANALYST_EVENT_CONFIG_FILE` for configured private events. Remote MCP endpoints use HTTPS with current operator authorization.

For retained operation, the host opens `LegalAnalystRuntime` with private context storage and current grant/source callbacks. Keep that state and the backend's source/review/audit state in separate owner-only persistent locations. Restart must revalidate current inputs and rights rather than restore authority from conversation history.

Run package tests, actual native/backend integration, installed qualification and isolated package/container checks for the exact artifact before deployment. Fixture qualification grants no legal clearance or professional acceptance. Configure enrolled human review and source rights for the intended operator; paid data access and field/legal correctness require their own evidence.
