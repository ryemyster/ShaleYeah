# How the SDK Works — @shaleyeah/sdk

## Plain language (12-year-old version)

In a big company, every department follows the same rules — same expense forms, same security badges, same HR policies. The SDK is those shared rules for the ShaleYeah fleet. Every one of the 14 expert servers and 14 agent packages uses the SDK to make sure they all speak the same language, call the AI the same way, and agree on what words like "formation" and "economics" mean.

Without the SDK, 28 packages would each reinvent their own way of talking to Claude and define their own idea of what a risk score looks like. With the SDK, there's one source of truth.

## Technical explanation

The SDK is a **shared library package** — it has no runtime of its own. It is compiled once and referenced by all 28 packages via `workspace:*` in pnpm.

### What it provides

| Module | What consumers get |
|--------|--------------------|
| `MCPServer` | Base class — extend to build a Tier 1 server |
| `callLLM()` | One function for all LLM calls — never `new Anthropic()` directly |
| `AgentManifest` / `AgentRuntimeConfig` | Zod schemas for agent contracts |
| `LocalAgentRuntime` | Full lifecycle manager: init, execute, HITL, shutdown |
| `LocalAgentEndpoint` | HTTP wrapper around a runtime |
| `RetryableToolError` / `PermanentToolError` | Error classification for tool responses |
| `FormationSchema`, `EconomicsSchema`, etc. | Canonical O&G domain model types |
| `FileFormatDetector` / `FileIntegrationManager` | Parsers for LAS, Excel, GeoJSON, SEG-Y |

### Build and consumption

```
sdk/src/*.ts → tsc → sdk/dist/
                          ↑ workspace:*
               servers/*, agents/*
```

### Transport auto-detection

`MCPServer` checks `process.env.PORT` at startup:
- Not set → `StdioServerTransport` (Claude Desktop, MCP CLI)
- Set → `StreamableHTTPServerTransport` on that port (agent fleet)

This is the only place in the entire monorepo where transport mode is decided.
