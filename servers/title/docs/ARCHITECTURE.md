# Architecture — @shaleyeah/server-title

## Role

Tier 1 MCP tool server. Verifies mineral rights ownership, identifies title defects, and assesses encumbrances.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `examine_title` | ✅ `callLLM` | Ownership percentage, risk level, encumbrances, title notes |

## LLM pattern

Passes legal description, county, and chain of title age to `callLLM()`. The response is validated against a Zod schema that enforces `ownershipPercentage`, `riskLevel` (`low | medium | high`), `encumbrances`, and `notes` fields.

## Key exports

`deriveDefaultTitleFindings(description, county, chainAge)` — deterministic fallback. Complex multi-parcel descriptions produce lower ownership percentages than simple single-parcel descriptions.

## Dependencies

```
@shaleyeah/server-title
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
