# How Legal Works — @shaleyeah/server-legal

## Plain language (12-year-old version)

Before you can drill on a piece of land, you need to make sure you actually have the right to — and that there aren't any legal landmines. Legal is the expert who reads the lease, checks state regulations, flags compliance requirements, and reviews contracts to find any terms that could cause problems.

You hand it a jurisdiction (like "Texas") and project type (like "exploration"), and it tells you: what's the regulatory risk, what compliance checkboxes do you need to hit, and are there any red flags in the contract?

## Technical explanation

Legal is a **Tier 1 MCP tool server** — stateless. It exposes 2 legal analysis tools.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `analyze_legal_framework` | Reviews jurisdiction, project type, lease terms; produces regulatory risk score and compliance checklist |
| `review_contract` | Reads contract text; flags obligations, penalties, and unusual terms |

### LLM + fallback pattern

```typescript
try {
  return await callLLM({ prompt: legalPrompt });
} catch (_err) {
  return deriveDefaultRegulatoryRisk(jurisdiction, projectType);
}
```

The fallback encodes real regulatory domain knowledge: California exploration is inherently "High" risk (CEQA, setbacks), Texas production is "Low" (favorable regulatory environment).

### Transport modes

- **stdio** (default): pipe-based
- **HTTP** (when `PORT=3006`): `StreamableHTTPServerTransport` — used by the legal-analyst agent
