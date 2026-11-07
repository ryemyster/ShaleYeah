# Integration — @shaleyeah/server-legal

## Who calls legal?

The `legal-analyst` agent (`agents/legal-analyst/`) connects over HTTP.

## Example call (agent side)

```typescript
import { callLegalTool } from "./legal-client.js";

const result = await callLegalTool(
    "http://localhost:3006",
    "analyze_legal_framework",
    {
        jurisdiction: "Texas",
        projectType: "development",
        leaseTerms: { royaltyRate: 0.25, primaryTerm: 5, bonus: 1000 },
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `analyze_legal_framework` | `jurisdiction`, `projectType` | Regulatory risk, compliance checklist |
| `review_contract` | `contractText`, `contractType` | Red flags, obligations, recommendations |

## Upstream dependencies

No upstream MCP servers.

```
legal (port 3006)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
legal (port 3006)
  ↑ MCP over HTTP
legal-analyst agent (port 4006)
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout" }
{ "error_type": "permanent", "message": "Unknown jurisdiction" }
```
