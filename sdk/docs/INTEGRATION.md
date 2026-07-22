# Integration — @shaleyeah/sdk

## Who uses the SDK?

Every package in the monorepo.

| Consumer type | What they use |
|--------------|--------------|
| Tier 1 MCP servers (14) | `MCPServer`, `callLLM()`, `RetryableToolError`, `PermanentToolError`, canonical schemas |
| Tier 2 agents (14) | `AgentManifest`, `AgentRuntimeConfig`, `LocalAgentRuntime`, `LocalAgentEndpoint`, `callLLM()` |
| Orchestrator (planned #362) | `AgentManifest`, `AgentRuntimeConfig` contracts |

## Server usage pattern

```typescript
import { MCPServer } from "@shaleyeah/sdk";

class MyServer extends MCPServer {
    registerTool("my_tool", schema, async (args) => {
        return await callLLM({ prompt: "..." });
    });
}

new MyServer().start();  // auto-detects stdio vs HTTP via PORT env
```

## Agent usage pattern

```typescript
import { LocalAgentRuntime, AgentManifest, AgentRuntimeConfig } from "@shaleyeah/sdk";

const runtime = new LocalAgentRuntime({ manifest, config, handlers });
await runtime.initialize();
const result = await runtime.execute({ toolName: "agent.tool", args });
await runtime.shutdown();
```

## LLM call pattern

```typescript
import { callLLM } from "@shaleyeah/sdk";

const response = await callLLM({
    system: "You are...",
    prompt: "Analyze...",
    apiKey: process.env.ANTHROPIC_API_KEY,
});
```

## Error classification pattern

```typescript
import { RetryableToolError, PermanentToolError } from "@shaleyeah/sdk";

// In a server tool handler:
if (network.isTimeout()) throw new RetryableToolError("upstream timeout");
if (input.isInvalid()) throw new PermanentToolError("invalid argument");
```

## Upstream dependencies

```
@shaleyeah/sdk
  └── @anthropic-ai/sdk   (LLM calls — only via callLLM())
  └── zod                 (schema validation)
  └── exceljs, turf, etc. (file parsers)
```
