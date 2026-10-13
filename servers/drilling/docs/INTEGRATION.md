# Integration — @shaleyeah/server-drilling

## Who calls drilling?

The ADK/Python `drilling-engineer` agent (`agents/drilling-engineer/`) connects to drilling over HTTP using the Python MCP Streamable HTTP client.

## Example call (agent side)

```python
from app.drilling_mcp import design_drilling_program

result = await design_drilling_program(
    well_parameters={
        "targetDepth": 10500,
        "wellType": "horizontal",
        "formation": "wolfcamp",
    },
    constraints={
        "budget": 8000000,
        "timeline": "Q3 2026",
    },
)
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `design_drilling_program` | `wellParameters` | Program risk, casing, mud, completion, considerations, recommendation |
| `estimate_well_costs` | `wellParameters` | Drilling, completion, facilities, total cost, cost/ft, estimated days |
| `assess_drilling_risks` | `wellParameters` | Geological, operational, environmental, and overall risk with mitigations |

## Direct MCP Input Shape

```json
{
  "wellParameters": {
    "targetDepth": 10500,
    "wellType": "horizontal",
    "formation": "wolfcamp"
  },
  "constraints": {
    "budget": 8000000,
    "timeline": "Q3 2026"
  }
}
```

## Upstream dependencies

No upstream MCP servers. Reads from Anthropic API only.

```
drilling (port 3003)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
drilling (port 3003)
  ↑ MCP over HTTP
drilling-engineer ADK agent
  ↑ agents-cli / ADK runtime
Orchestrator / API client
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout" }
{ "error_type": "permanent", "message": "Invalid well type" }
```
