# Architecture

The Infrastructure Planner is a package-local ADK/Python agent. Its primary architecture mode is **Stand-alone Agent with Progressive Disclosure (Skills)**.

The agent is a specialist diligence role, not an orchestrator. It exposes a compact set of Infrastructure MCP capabilities and uses them only when the user's request calls for that work.

## Responsibilities

The agent owns:

- interpreting infrastructure-planning intent
- choosing the right Infrastructure MCP tool
- identifying missing inputs and confidence limits
- explaining assumptions and data-source limits
- enforcing HITL deferral for final approvals, certifications, commitments, disclosures, and sensitive memory promotion
- package-local pytest and eval coverage

The backend owns:

- MCP schemas and execution for `plan_pipeline`, `size_facilities`, `estimate_costs`, and `assess_compliance`
- deterministic fallback calculations and optional LLM synthesis
- structured outputs for pipeline, facilities, cost, and compliance work

## Tool Surface

| Tool | Purpose |
|------|---------|
| `plan_pipeline` | Pipeline/gathering route, capacity, and takeaway-risk planning |
| `size_facilities` | Tanks, batteries, separators, compression, and SWD sizing |
| `estimate_costs` | Pipeline, facility, compression, and SWD CAPEX estimates |
| `assess_compliance` | Permitting, safety, environmental, ROW, and regulatory review support |

## HITL Boundary

The agent may draft diligence support and provisional engineering assumptions. It must defer final pipeline route approval, facility layout approval, construction authorization, AFE/capital/procurement approval, right-of-way and easement decisions, midstream commercial commitments, FERC/state/local permit certification, PHMSA compliance certification, UIC/Class II approval, environmental conclusions, public disclosure, and sensitive shared-memory promotion.

In the current implementation this is a documented ADK deferral boundary enforced through instructions, planning/status tools, and eval cases. It is not yet a graph-level runtime gate.
