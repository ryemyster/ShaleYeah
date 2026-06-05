# @shaleyeah/legal-analyst

> **Status: Stub** — implementation tracked in [#370](https://github.com/ryemyster/ShaleYeah/issues/370). Reference implementation: `agents/geologist/`.

The legal analyst agent reviews contracts, checks regulatory compliance, summarizes lease terms, flags surface and mineral rights issues, and identifies material legal risks. It pairs with the **legal** Tier 1 MCP server (port 3006).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-legal` | 3006 |
| Tier 2 (agent) | `@shaleyeah/legal-analyst` | 4006 |

## Quick start (once implemented)

```bash
# Terminal 1 — Tier 1 server
cd servers/legal && PORT=3006 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/legal-analyst
ANTHROPIC_API_KEY=sk-ant-... LEGAL_MCP_URL=http://localhost:3006 pnpm test
```

## Implementing this agent

See `.claude/rules/agent-template.md` for the full copy-paste template. The geologist agent (`agents/geologist/src/agent/index.ts`) is the reference — copy it, rename `geologist` → `legalAnalyst` and `geowiz` → `legal`.

> **Note:** Legal tools that modify documents (contract redlines) should set `requiresHumanApproval: true` and `destructive: true` in the tool manifest.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
