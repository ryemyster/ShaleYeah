# How Title Works — @shaleyeah/server-title

## Plain language (12-year-old version)

When you want to buy oil rights in the ground, you first need to make sure the person selling them actually owns them — and that no one else has a claim on them. This is called a title examination. It's like making sure someone actually owns the house before you buy it, except mineral rights are way more complicated — they can be split, inherited, leased, and encumbered in dozens of ways.

The Title server reads a legal description and looks at who has owned the rights and for how long, then tells you: what percentage of the rights appear to be clean, how risky the title looks, what encumbrances exist, and any notes a lawyer would flag.

## Technical explanation

Title is a **Tier 1 MCP tool server** — stateless. It exposes 1 title examination tool backed by LLM synthesis.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `examine_title` | Ownership percentage, risk level, encumbrances, title notes |

### Request lifecycle

```
Agent (title-analyst)
  → MCP tool call: examine_title { description, county, chainAge }
      ↓
  Title server (src/index.ts)
      ↓
  1. callLLM(title examination prompt)
  2. Zod schema validation → { ownershipPercentage, riskLevel, encumbrances, notes }
     OR fallback: deriveDefaultTitleFindings(description, county, chainAge)
  3. Return: structured title findings
```

### Output schema

```typescript
{
  ownershipPercentage: number,       // 0–100
  riskLevel: "low" | "medium" | "high",
  encumbrances: string[],
  notes: string
}
```

### Transport modes

- **stdio** (default): pipe-based
- **HTTP** (when `PORT=3010`): `StreamableHTTPServerTransport` — used by the title-analyst agent
