# Architecture — @shaleyeah/geologist

## Tier placement

```
agents/geologist  (Tier 2)
  └── depends on → @shaleyeah/server-geowiz  (Tier 1)
  └── depends on → @shaleyeah/sdk  (contracts, runtime)
```

## How it works

The geologist agent wraps geowiz's exported functions (`assessDataQuality`, `performFormationAnalysis`, etc.) as `StandaloneToolHandler` entries in its runtime config. When the `LocalAgentRuntime` executes a tool call, it dispatches to the appropriate handler function, which calls the geowiz function directly.

No MCP transport is used in the agent-internal path — geowiz functions are called as TypeScript imports. The MCP layer is only active when a client (like Claude Desktop) connects to geowiz as a standalone server.
