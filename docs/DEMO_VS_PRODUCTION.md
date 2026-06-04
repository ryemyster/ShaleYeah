# Demo vs Production

SHALE YEAH has two ways to run. This page explains what each one proves.

---

## Demo mode (`pnpm demo`)

Runs the **geologist agent standalone** — no API key, no kernel, no orchestrator.

```bash
pnpm demo
# Demo result: completed
# Evals: [ 'schema: pass', 'redactSecrets: pass' ]
# ✅ Geologist agent demo complete
```

**What it proves:**
- The two-tier architecture works: `agents/geologist/` wraps `servers/geowiz/` tools via direct TypeScript imports
- The `LocalAgentRuntime` contract executes tools and enforces eval policies
- The `AgentManifest` configuration boots without external dependencies

**What it does NOT do:**
- Call the Anthropic API — no real LLM synthesis happens
- Run all 14 agents — only geologist is fully implemented; the other 12 are stubs pending migration issues #364–#375
- Read real input files — `demo-placeholder.las` is a placeholder filename; the agent handles missing files gracefully

**When to use it:**
- Verifying the system runs after a code change
- CI smoke test (no API key needed)
- Demonstrating standalone agent architecture to a new contributor

---

## Production mode (MCP server + live LLM)

Each server runs as a standalone MCP server with real Anthropic API calls:

```bash
cd servers/geowiz
ANTHROPIC_API_KEY=sk-ant-... pnpm start
```

**What it does:**
- Boots the server's MCP transport (stdio)
- Accepts tool calls from a connected MCP client (Claude Desktop, VS Code, etc.)
- For each tool call: tries LLM synthesis via `callLLM()`, falls back to deterministic estimates if the key is absent or the network is down

**Connecting to Claude Desktop:**

```json
{
  "mcpServers": {
    "geowiz": {
      "command": "pnpm",
      "args": ["--filter", "@shaleyeah/server-geowiz", "start"],
      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }
    }
  }
}
```

**All 14 servers:**

| Filter | Purpose |
|--------|---------|
| `@shaleyeah/server-geowiz` | Geological analysis |
| `@shaleyeah/server-econobot` | Economic analysis |
| `@shaleyeah/server-curve-smith` | Decline curves |
| `@shaleyeah/server-decision` | Investment decision |
| `@shaleyeah/server-reporter` | Report generation |
| `@shaleyeah/server-research` | Web research |
| `@shaleyeah/server-risk-analysis` | Monte Carlo risk |
| `@shaleyeah/server-legal` | Legal/regulatory |
| `@shaleyeah/server-market` | Commodity prices |
| `@shaleyeah/server-title` | Title analysis |
| `@shaleyeah/server-development` | Development planning |
| `@shaleyeah/server-drilling` | Drilling engineering |
| `@shaleyeah/server-infrastructure` | Midstream infrastructure |
| `@shaleyeah/server-qa` | Quality assurance |

See [MCP_INTEGRATION.md](./MCP_INTEGRATION.md) for full client setup instructions.
