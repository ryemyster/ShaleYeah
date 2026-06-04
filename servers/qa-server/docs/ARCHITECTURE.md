# Architecture — @shaleyeah/server-qa

## Tier placement

This package is a **Tier 1 MCP tool server**. It exposes domain-specific tools via the MCP protocol. It has no knowledge of Tier 2 agents or the orchestrator.

## Dependencies

```
@shaleyeah/server-qa
  └── @shaleyeah/sdk   (MCPServer base, LLMClient, domain types)
```

## LLM calls

All LLM calls use `callLLM()` from `@shaleyeah/sdk`, which wraps the shared `LLMClient`. No direct Anthropic SDK instantiation.

## Orchestrator connection

This server is consumed by agents in `agents/` via MCP tool calls. It does not import from any agent package.
