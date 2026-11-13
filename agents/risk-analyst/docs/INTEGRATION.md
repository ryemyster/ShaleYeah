# Integrating Risk Analyst
Use `create_risk_analyst_agent` for the native factory and `RiskAnalystRuntime.open` for retained working context. Supply a configured backend, explicit model profiles, credential resolver and trusted context catalog. The host owns current context and source grants. [Shared context documentation](../../../sdk/employee/README.md) describes the installed helpers.

The backend connection uses `RISK_ANALYSIS_MCP_URL` (default `http://127.0.0.1:3005/mcp`) and an owner-only `RISK_ANALYSIS_MCP_ACCESS_TOKEN_FILE`. The selected profile is MCP 2026-07-28 with self-contained requests, fresh schema discovery, bounded calls and structured failures. Caller, provider and source credentials stay separate.

Role tools discover inputs, read paged source text, calculate/compare scenarios, draft work, prepare review, read review status and record an approved private appraisal. Python arguments map exact task/model IDs and revisions. Retrieved text cannot supply identity, an endpoint, a credential or approval authority.

The final JSON contract has only `work` and `risk`; an explicit `deferred` string is the alternative. A host must grade the actual returned response through the installed scorecard. Replacing it with a correct backend object would hide employee errors.

`ReviewSupervisor` wraps the installed business-state adapter and translates only the fixed Risk review operations. On resume it reads the backend checkpoint and records only an exact, current, qualified human-approved action. An approved deterministic transition needs no model call.

Compatible external MCP fixtures prove transport and argument/result mapping. They do not certify another backend's calculations, source rights or review controls. Independent use and supported substitution must retain those contracts and pass their own qualification.
