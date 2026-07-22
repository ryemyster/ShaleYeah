# Architecture — @shaleyeah/server-legal

## Role

Tier 1 MCP tool server. Reviews lease terms, regulatory compliance, and legal risk for O&G properties. Paired with the `legal-analyst` agent (port 4006).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `analyze_legal_framework` | `callLLM()` | ✅ `callLLM` | Lease risk, regulatory environment, compliance checklist |
| `review_contract` | `callLLM()` | ✅ `callLLM` | Contract term review, red flags, obligations |

## LLM + fallback pattern

Calls `callLLM()` with jurisdiction, project type, and contract terms. Falls back to `deriveDefaultRegulatoryRisk(jurisdiction, projectType)` — deterministic rules: California exploration → "High", Texas production → "Low".

## Key exports

`deriveDefaultRegulatoryRisk(jurisdiction, projectType)` — exported pure function, used in anti-stub tests to verify no hardcoded stubs.

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3006`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: analyze_legal_framework { jurisdiction, projectType, leaseTerms }
  → callLLM(legal prompt with jurisdiction + project details)
  ↘ fallback: deriveDefaultRegulatoryRisk(jurisdiction, projectType)
```

## Dependencies

```
@shaleyeah/server-legal
  └── @shaleyeah/sdk   (MCPServer, callLLM, ServerFactory)
```
