# Architecture

`agents/research-analyst` is a package-local ADK/Python agent. It owns the agent instructions, source-quality reasoning, tool-selection behavior, evals, and human-review boundary for oil and gas research intelligence.

`servers/research` is the separate TypeScript MCP backend. It owns the executable tools:

- `conduct_market_research`
- `analyze_competition`

## Runtime Shape

```text
Caller or orchestrator
        |
        v
agents/research-analyst
ADK root agent, Python MCP wrappers, evals
        |
        | Streamable HTTP MCP
        v
servers/research
TypeScript MCP tools, schemas, deterministic fallbacks
```

The agent can run locally, in a container, or behind an agent runtime. The backend URL is runtime configuration, not a code dependency.

## Architecture Mode

Mode: **Stand-alone Agent with Progressive Disclosure (Skills)**.

That means this package is a single specialist agent. It exposes a small tool menu to the model and calls the Research MCP tools only when the user request needs them.

The current package is not a hierarchical orchestrator, graph workflow, ambient event processor, or capability-first arbitrator. Those patterns may become useful later for source-quality workflow gates, scheduled market monitoring, source-specific worker agents, or deterministic source adapters.

## Human Review Boundary

The agent may draft source-backed intelligence, summarize evidence, identify gaps, and prepare research handoffs. It must defer:

- final investment recommendation
- bid or no-bid authorization
- capital allocation or trade execution
- securities-disclosure language
- reserve or resource classification
- legal, title, regulatory, or compliance conclusion
- publication of confidential or proprietary research
- shared-memory promotion of sensitive research

When the user asks for one of those actions, the agent should explain what the evidence supports, what remains uncertain, and what qualified human review is required.
