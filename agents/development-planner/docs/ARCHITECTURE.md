# Architecture

`agents/development-planner` is a package-local ADK/Python agent. It owns the agent instructions, tool-selection behavior, evals, and human-review boundary for field-development planning.

`servers/development` is the separate TypeScript MCP backend. It owns the executable tools:

- `create_development_plan`
- `estimate_project_timeline`
- `monitor_development_progress`

## Runtime Shape

```text
Caller or orchestrator
        |
        v
agents/development-planner
ADK root agent, Python MCP wrappers, evals
        |
        | Streamable HTTP MCP
        v
servers/development
TypeScript MCP tools, schemas, deterministic fallbacks
```

The agent can run locally, in a container, or behind an agent runtime. The backend URL is runtime configuration, not a code dependency.

## Architecture Mode

Mode: **Stand-alone Agent with Progressive Disclosure (Skills)**.

That means this package is a single specialist agent. It exposes a small tool menu to the model and calls the Development MCP tools only when the user request needs them.

This package is not a hierarchical orchestrator, graph workflow, ambient event processor, or capability-first arbitrator. Those patterns may become useful later for portfolio-wide orchestration, stage-gate workflows, event-driven progress updates, or deterministic routing, but #534 keeps this agent standalone.

## Human Review Boundary

The agent may draft planning support, summarize schedule risk, and identify missing inputs. It must defer:

- final field development plan approval
- final investment decision
- AFE or capital authorization
- development sanction
- drilling sequence authorization
- facility or surface execution
- regulatory submissions
- external partner, vendor, or operator commitments

When the user asks for one of those actions, the agent should explain what it can support and require qualified human review.
