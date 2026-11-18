# Integration — @shaleyeah/server-title

## Who calls title?

The `title-analyst` agent (`agents/title-analyst/`) connects over HTTP.

## Example call (agent side)

```typescript
import { callTitleTool } from "./title-client.js";

const result = await callTitleTool(
    "http://localhost:3010",
    "examine_title",
    {
        description: "Section 14, Township 2S, Range 32E, Lea County, NM",
        county: "Lea County",
        chainAge: 45,
    },
);
```

## Tool call reference

| Tool | Required args | Returns |
|------|--------------|---------|
| `examine_title` | `description`, `county`, `chainAge` | `{ ownershipPercentage, riskLevel, encumbrances, notes }` |

## Upstream dependencies

Title is self-contained — no external data calls.

```
title (port 3010)
  ↓ callLLM()
Anthropic API
```

## Downstream consumers

```
title (port 3010)
  ↑ MCP over HTTP
title-analyst agent (port 4010)
```

## Error types

```json
{ "error_type": "retryable", "message": "LLM timeout — retry" }
{ "error_type": "permanent", "message": "Invalid description: missing section reference" }
```
