# Integration

## Who calls infrastructure?

The `infrastructure-planner` ADK agent (`agents/infrastructure-planner/`) connects over HTTP. Other compatible MCP clients can call the server directly.

## Example call

```json
{
  "tool": "plan_pipeline",
  "arguments": {
    "wellCount": 8,
    "expectedProduction": 1200,
    "location": "Eddy County, NM"
  }
}
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `plan_pipeline` | `wellCount`, `expectedProduction`, `location` | Pipeline/gathering plan, capacity, takeaway risk, confidence |
| `size_facilities` | `wellCount`, `expectedProduction`, `location` | Facility sizing, compressors, SWD wells, notes, confidence |
| `estimate_costs` | `wellCount`, `compressors`, `swdWells`, `location` | Pipeline, facility, compression, SWD, total CAPEX, confidence |
| `assess_compliance` | `wellCount`, `location`; optional `environmentalConstraints` | Permits, timeline, environmental risks, critical path, confidence |

## Upstream dependencies

Infrastructure is self-contained aside from shared LLM synthesis through `callLLM()`.

```
infrastructure (port 3012)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
infrastructure (port 3012)
  ↑ MCP over HTTP
infrastructure-planner ADK agent
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout — retry" }
{ "error_type": "permanent", "message": "productionRate must be a positive number" }
```
