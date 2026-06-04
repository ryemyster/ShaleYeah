# Architecture — @shaleyeah/server-legal

## Role

Tier 1 MCP tool server. Reviews lease terms, regulatory compliance, and legal risk for O&G properties.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `analyze_legal_framework` | ✅ `callLLM` | Lease risk, regulatory environment, compliance checklist |

## Key exports

`deriveDefaultRegulatoryRisk(jurisdiction, projectType)` — pure deterministic function. Returns "High" for California exploration, "Low" for Texas production, etc. Used in tests to verify no hardcoded stub values.

## Dependencies

```
@shaleyeah/server-legal
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
