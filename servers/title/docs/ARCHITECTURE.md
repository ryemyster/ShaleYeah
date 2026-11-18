# Architecture — @shaleyeah/server-title

## Role

Tier 1 MCP tool server. Verifies mineral rights ownership, identifies title defects, and assesses encumbrances. Paired with the `title-analyst` agent (port 4010).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `examine_title` | LLM + Zod schema | ✅ `callLLM` | Ownership percentage, risk level, encumbrances, title notes |

## LLM + fallback pattern

Passes legal description, county, and chain of title age to `callLLM()`. Response is validated against a Zod schema enforcing `ownershipPercentage`, `riskLevel` (`low | medium | high`), `encumbrances`, and `notes`. Falls back to `deriveDefaultTitleFindings()` if the API is unavailable.

## Key exports

`deriveDefaultTitleFindings(description, county, chainAge)` — deterministic fallback. Complex multi-parcel descriptions produce lower ownership percentages than simple single-parcel descriptions.

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3010`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: examine_title { description, county, chainAge }
  → callLLM(title examination prompt)
  → Zod schema validation → { ownershipPercentage, riskLevel, encumbrances, notes }
  ↘ fallback: deriveDefaultTitleFindings(description, county, chainAge)
```

## Dependencies

```
@shaleyeah/server-title
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
