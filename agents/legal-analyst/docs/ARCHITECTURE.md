# Architecture - Legal Analyst ADK Agent

Legal Analyst is a Tier 2 ADK/Python package. It owns agent reasoning, tool-selection policy, architecture classification, eval coverage, and human/legal-review boundaries for legal diligence.

The Tier 1 execution backend is [`servers/legal`](../../../servers/legal), an independently runnable MCP service for legal diligence tools.

## Architecture Mode

Primary mode: **Stand-alone Agent with Progressive Disclosure (Skills)**.

Legal Analyst is a stand-alone specialist that equips package-local instructions, eval criteria, and Legal MCP tools when legal diligence is requested. It is not a hierarchical orchestrator, graph workflow, ambient event-driven agent, or capability-first arbitrator in #531.

Graph-based workflow is reserved for a later issue if legal review needs deterministic nodes, conditional routes, stateful sessions, or explicit HITL gates as workflow nodes.

## Package Boundary

```text
agents/legal-analyst/
  agents-cli-manifest.yaml   ADK project marker
  .agents-cli-spec.md        reference-pair spec, architecture mode, and package constraints
  pyproject.toml             Python package and test dependencies
  app/agent.py               ADK root agent
  app/legal_mcp.py           Python MCP client wrappers
  tests/                     pytest shape tests and eval references
```

## Execution Flow

1. ADK receives a legal diligence task through `app/agent.py`.
2. The agent classifies the task as legal framework, contract review, or compliance assessment.
3. `app/legal_mcp.py` calls the Legal MCP server through streamable HTTP.
4. `servers/legal` performs the domain operation and returns MCP content.
5. The ADK agent summarizes the result without making binding legal decisions.

## Current Tool Parity

| ADK tool | Backend MCP tool | Purpose |
|----------|------------------|---------|
| `analyze_legal_framework` | `analyze_legal_framework` | Jurisdiction/project regulatory and legal exposure |
| `review_contract` | `review_contract` | Oil and gas contract-risk diligence |
| `assess_compliance` | `assess_compliance` | Environmental, safety, and tax compliance requirements |

## Runtime Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `LEGAL_MCP_URL` | `http://localhost:3006` | Legal MCP backend URL |
| `LEGAL_ANALYST_ADK_MODEL` | `gemini-flash-latest` | Local ADK model id |

## HITL Boundary

Legal Analyst may analyze legal exposure, contract risk, compliance requirements, and missing diligence inputs. It must defer legal opinions, contract redlines, signatures, filings, regulatory submissions, waivers, settlement positions, enforcement decisions, and binding approvals to human/legal review.
