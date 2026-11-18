# Economist architecture

Mode: **Stand-alone Agent with Progressive Disclosure (Skills)**. One native ADK
agent owns the financial-analysis job; it has no child agents. It retrieves exact
source detail as needed instead of inserting all historical conversations into
every prompt. Econobot owns deterministic calculations and protected business
transitions. Its review state machine is separate from the agent's reasoning.

`app/agent.py` creates the role and constrained tools using the installed model
adapter. `app/econobot_mcp.py` maps those tools to the configured independent MCP
service. `app/context_runtime.py` binds the installed native runtime to this role's
catalog, all financial source identities and pending review references.
`app/review_supervision.py` resumes exact human decisions without another model
call. `app/evaluation.py` grades the actual final response against trusted host
observations and independent financial references.

The host owns customer, asset, task, employee and principal identity. Context
reads, assembly, writes and restoration recheck current rights and retention.
Source metadata is revalidated at the backend; an identifier or retrieved text
cannot grant access. Source changes invalidate work; approved knowledge is never
silently replaced by model output. A completed review clears its pending reference
through a new private checkpoint revision, preserving earlier history.

The employee can retrieve, calculate, compare and draft within granted authority.
A separately authenticated human owns assumptions and scenario approval. The
executing backend checks exact task/work/context/source/evaluation/action bindings
before private storage. Native confirmation and model text cannot approve an
investment. Capital commitments and external publication remain unsupported.

Agent, tool, optional synthesis and judge credentials are separate. Correlated
metadata events omit raw credentials and source text. The host supplies private
storage, retention and audit destinations. No warehouse, vector service,
orchestrator or particular cloud is required.
