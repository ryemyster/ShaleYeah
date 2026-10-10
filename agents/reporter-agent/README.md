# @shaleyeah/reporter-agent

> **Status: Stub** — implementation tracked in [#368](https://github.com/ryemyster/ShaleYeah/issues/368). Reference implementation: `agents/geologist/`.

The reporter agent assembles analysis outputs from the other agents into formatted reports, executive summaries, well decks, and presentations. It pairs with the **reporter** Tier 1 MCP server (port 3009).

## Pair

| Layer | Package | Port |
|-------|---------|------|
| Tier 1 (tools) | `@shaleyeah/server-reporter` | 3009 |
| Tier 2 (agent) | `@shaleyeah/reporter-agent` | 4009 |

## Quick start (once implemented)

```bash
# Terminal 1 — Tier 1 server
cd servers/reporter && PORT=3009 pnpm start

# Terminal 2 — Tier 2 agent
cd agents/reporter-agent
ANTHROPIC_API_KEY=sk-ant-... REPORTER_MCP_URL=http://localhost:3009 pnpm test
```

## Implementing this agent

See `.claude/rules/agent-template.md` for the full copy-paste template. The geologist agent (`agents/geologist/src/agent/index.ts`) is the reference — copy it, rename `geologist` → `reporterAgent` and `geowiz` → `reporter`.

> **Note:** Report generation tools write files to disk and should set `destructive: true`. Consider `requiresHumanApproval: true` for reports that will be sent externally.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [How It Works](docs/HOW_IT_WORKS.md)
- [Development](docs/DEVELOPMENT.md)
- [Integration Guide](docs/INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Local Testing](docs/LOCAL_TESTING.md)
