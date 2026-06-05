# @shaleyeah/investment-chair

> **Status: Stub** — implementation tracked in [#367](https://github.com/ryemyster/ShaleYeah/issues/367). Reference implementation: `agents/geologist/`.

The investment chair agent synthesizes outputs from the full agent fleet — geology, economics, risk, legal, market — into a final investment recommendation and go/no-go decision package. It pairs with the **decision** Tier 1 MCP server (port 3013).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-decision` | 3013 |
| Tier 2 (agent) | `@shaleyeah/investment-chair` | 4013 |

## Quick start (once implemented)

```bash
# Terminal 1 — Tier 1 server
cd servers/decision && PORT=3013 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/investment-chair
ANTHROPIC_API_KEY=sk-ant-... DECISION_MCP_URL=http://localhost:3013 pnpm test
```

## Implementing this agent

See `.claude/rules/agent-template.md` for the full copy-paste template. The geologist agent (`agents/geologist/src/agent/index.ts`) is the reference — copy it, rename `geologist` → `investmentChair` and `geowiz` → `decision`.

> **Note:** The investment chair makes consequential financial decisions. All decision-output tools should set `requiresHumanApproval: true`. This agent will likely use `deep-reasoning` model routing for final synthesis.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
