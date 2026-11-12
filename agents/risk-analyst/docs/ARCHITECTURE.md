# Risk Analyst architecture
The primary mode is **Stand-alone Agent with Progressive Disclosure (Skills)**. One native ADK (Agent Development Kit) employee uses metadata discovery and bounded source detail. It has no delegated children.

`app/agent.py` owns persona, tool registration, explicit provider configuration and callbacks. `app/risk_analysis_mcp.py` maps role operations through the installed MCP (Model Context Protocol) client. `app/context_runtime.py` adds role-specific source and review references around the installed employee runtime. `app/evaluation.py` grades the actual final response, with trusted observations supplied separately by the host.

Risk Analysis owns source hashes, current grants, deterministic arithmetic, policy coverage, enrolled human decisions and private recording. Its durable business transitions are backend enforced; ADK confirmation alone grants no business authority.

Context is private to customer, asset, task and employee. Successful source references are reauthorized before retention or use; malformed, duplicate, stale or revoked evidence blocks continuation. Review preparation rederives work before it enters the catalog. Pending review references survive restart, while approval grants remain in the backend. Shared knowledge cannot be silently promoted from model output.

Agents and tools install separately through declared contracts, client and runtime packages. Neither the coordinator nor a cloud deployment is required. Framework, provider and storage types remain adapter-local.
