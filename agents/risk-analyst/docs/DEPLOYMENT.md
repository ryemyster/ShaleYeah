# Running Risk Analyst
The employee and Risk Analysis backend are separate units. Local embedding uses `RiskAnalystRuntime.open` with an owner-scoped context catalog, current grants, explicit model configuration and a separately authenticated backend connection.

`RISK_ANALYST_MODEL_CONFIG_FILE` selects the private provider profile. `RISK_ANALYST_EVENT_CONFIG_FILE` optionally selects required structured event export. `RISK_ANALYSIS_MCP_URL`, `RISK_ANALYSIS_MCP_ACCESS_TOKEN_FILE` and the installed client's bounded timeout settings configure the backend connection. Credentials are resolved outside prompts and work products.

The [extraction recipe](../../../servers/risk-analysis/scripts/check-extraction.mjs) builds independent source, wheels and production archives. The package Dockerfile consumes that bundle. The [container qualification](../../../servers/risk-analysis/scripts/check-containers.py) checks separate non-root employee/tool images with actor-specific mounts, exact review and restart.

Container verification requires a Docker-compatible Linux runtime. Its required hosted CI result supplies release evidence; a Dockerfile or successful import alone is insufficient. VM, Fly.io, Cloud Run, GKE, Agent Runtime and other hosts need their own configuration and evidence. No target, orchestrator, warehouse or vector service is mandatory.
