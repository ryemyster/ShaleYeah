# How It Works — Drilling Engineer ADK Agent

The Drilling Engineer agent is the Tier 2 reasoning layer for drilling diligence. It decides which Drilling MCP tool to call, asks for missing inputs when needed, and summarizes the backend result without granting final operational authority.

## Flow

1. A user asks for drilling program design, well cost estimation, or drilling risk assessment.
2. `app/agent.py` keeps the agent in the Stand-alone Agent with Progressive Disclosure (Skills) mode and plans the Drilling backend tool.
3. `app/drilling_mcp.py` calls `servers/drilling` over Streamable HTTP using `DRILLING_MCP_URL`.
4. `servers/drilling` runs the deterministic/LLM-backed MCP tool and returns structured MCP content.
5. The ADK agent summarizes the result as diligence support and defers final AFE, spud, field-execution, and safety approval to human engineering review.

## Backend Tools

| Task | Drilling MCP tool |
|------|-------------------|
| Program design | `design_drilling_program` |
| Cost estimation | `estimate_well_costs` |
| Risk assessment | `assess_drilling_risks` |

## Current Limits

- No live rig-rate quote integration.
- No directional-drilling software integration.
- No regulatory permit submission.
- No final AFE, spud, field-execution, or safety approval without human engineering review.
