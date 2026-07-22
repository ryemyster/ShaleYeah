# Integration — Title Analyst ADK Agent

Integrate with Title Analyst through the ADK project in `agents/title-analyst`.

## Local ADK Invocation

```bash
cd agents/title-analyst
TITLE_MCP_URL=http://localhost:3010 agents-cli run \
  "Trace chain of title for Section 3 in Weld County, Colorado over 40 years"
```

## Backend Contract

The agent calls the Title-compatible MCP backend configured by `TITLE_MCP_URL`.

| Backend tool | Agent wrapper |
|--------------|---------------|
| `examine_ownership` | `examine_title_ownership` |
| `analyze_lease` | `analyze_title_lease` |
| `check_burdens` | `check_title_burdens` |
| `trace_chain_of_title` | `trace_title_chain_of_title` |

## Orchestrator Boundary

Future orchestration should call the ADK agent as a standalone unit. Keep task routing, fleet learning loops, and deployment control plane work outside this package unless an issue explicitly scopes it here.

## Server Integration

Claude Desktop and other MCP clients can connect directly to `servers/title` for Tier 1 tool access. The Tier 2 Title Analyst behavior remains in ADK and uses the same backend URL.
