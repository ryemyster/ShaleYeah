# Integration — Drilling Engineer ADK Agent

Integrate with Drilling Engineer through the ADK project in `agents/drilling-engineer`. Do not import a TypeScript agent package from this directory; that adapter has been retired.

## Local ADK Invocation

```bash
cd agents/drilling-engineer
DRILLING_MCP_URL=http://localhost:3003 agents-cli run \
  "Assess drilling risks for a deep horizontal shale well at 13500 ft"
```

## Backend Contract

The agent calls the Drilling-compatible MCP backend configured by `DRILLING_MCP_URL`.

| Backend tool | Agent wrapper |
|--------------|---------------|
| `design_drilling_program` | `design_drilling_program` |
| `estimate_well_costs` | `estimate_well_costs` |
| `assess_drilling_risks` | `assess_drilling_risks` |

## Orchestrator Boundary

Future orchestration should call the ADK agent as a standalone unit. Keep task routing, fleet learning loops, runtime eval nodes, and deployment control plane work outside this package unless an issue explicitly scopes it here.

## Server Integration

Claude Desktop and other MCP clients can connect directly to `servers/drilling` for Tier 1 tool access. The Tier 2 Drilling Engineer behavior remains in ADK and uses the same backend URL.
