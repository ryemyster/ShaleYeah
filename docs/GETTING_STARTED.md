# Getting Started with SHALE YEAH

Welcome to SHALE YEAH — a pnpm workspace monorepo of 14 specialist AI agents for oil & gas investment due diligence.

## Prerequisites

- **Node.js 22+** — [nodejs.org](https://nodejs.org/)
- **pnpm** — `npm install -g pnpm`
- **Git**

## Quick start (3 commands)

```bash
git clone https://github.com/ryemyster/ShaleYeah.git
cd ShaleYeah
pnpm install
pnpm demo       # geologist agent boots standalone — no API key required
```

**What `pnpm demo` does:** boots the geologist agent (`agents/geologist/`) without a kernel, orchestrator, or API key. Proves the two-tier architecture works.

## Build and test everything

```bash
pnpm turbo build   # all 30 packages, dependency order: sdk → servers → agents
pnpm turbo test    # all test suites
pnpm turbo lint    # Biome across all packages
```

## Repo structure

```
ShaleYeah/
├── sdk/                    @shaleyeah/sdk — shared language (types, LLM client, MCP base)
├── servers/                Tier 1 — 14 MCP tool servers
│   ├── geowiz/             Geological analysis
│   ├── econobot/           Economic analysis
│   └── ... (12 more)
├── agents/                 Tier 2 — 14 agent intelligence packages
│   ├── geologist/          Fully implemented (wraps geowiz tools)
│   ├── agent-zero/         Reference contract implementation
│   └── ... (12 stubs, filled in per migration issue)
├── orchestrator/           Temporal workflow stub (#362)
├── demo.ts                 Standalone geologist agent demo
├── pnpm-workspace.yaml
└── turbo.json
```

## Run a single MCP server

```bash
cd servers/geowiz
pnpm start      # launches geowiz as a standalone MCP server on stdio
```

Connect it to Claude Desktop:
```json
{
  "mcpServers": {
    "geowiz": {
      "command": "pnpm",
      "args": ["--filter", "@shaleyeah/server-geowiz", "start"]
    }
  }
}
```

## Work on a specific package

```bash
cd sdk && pnpm build && pnpm test
cd servers/geowiz && pnpm build && pnpm test
cd agents/geologist && pnpm build && pnpm test
```

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | For real AI output | LLM synthesis in all servers and agents. Without it, servers fall back to rule-based estimates. |
| `EIA_API_KEY` | Optional | Real WTI/Henry Hub prices in `servers/market/`. See `servers/market/docs/EIA_API_SETUP.md`. |

```bash
# .env (never commit)
ANTHROPIC_API_KEY=sk-ant-...
EIA_API_KEY=your_eia_key_here
```

## Add a new analysis tool to an existing server

```bash
# 1. Edit the server
$EDITOR servers/<name>/src/index.ts
# 2. Add a registerTool() call in setupCapabilities()
# 3. Build and test
cd servers/<name> && pnpm build && pnpm test
```

## Add a new file parser

```bash
# 1. Add parser to sdk
$EDITOR sdk/src/parsers/<format>-parser.ts
# 2. Wire into FileIntegrationManager
$EDITOR sdk/src/file-integration.ts
# 3. Build sdk
cd sdk && pnpm build && pnpm test
```

## Next steps

- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md) — two-tier system, package layout
- **MCP clients**: [MCP_INTEGRATION.md](./MCP_INTEGRATION.md) — connect to Claude Desktop / VS Code
- **Deploy an agent**: [STANDALONE_AGENT_DEPLOYMENT.md](./STANDALONE_AGENT_DEPLOYMENT.md)
- **Contributing**: [CONTRIBUTING.md](../CONTRIBUTING.md)
