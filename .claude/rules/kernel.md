---
paths:
  - "sdk/src/**/*.ts"
  - "sdk/tests/**/*.test.ts"
---

# SDK Implementation Rules

The SDK (`sdk/src/`) is the shared foundation all servers and agents build on. The kernel was merged into the SDK during the monorepo conversion (#385).

| File | Role |
|---|---|
| `llm-client.ts` | `callLLM()` — only allowed path for Anthropic SDK calls |
| `mcp-server.ts` | `MCPServer` abstract base — all 14 servers inherit from this |
| `server-factory.ts` | `runMCPServer()` — entry point for server processes |
| `runtime.ts` | `LocalAgentRuntime`, `LocalAgentEndpoint` — agent execution contract |
| `contracts.ts` | `AgentManifest`, `AgentRuntimeConfig` Zod schemas |
| `canonical-model.ts` | Shared canonical model types for cross-server data exchange |
| `service.ts` | `AgentService` — HTTP service layer for agent endpoints |
| `types.ts` | Shared TypeScript types |

## Rules
- All shared types live in `sdk/src/types.ts` or `sdk/src/contracts.ts` — do not define shared types inline in server/agent files
- All LLM calls go through `callLLM()` from `@shaleyeah/sdk` — never import `@anthropic-ai/sdk` directly in a server or agent
- `mcp-server.ts` and `server-factory.ts` are exempt from the `no z.any()` rule (Zod runtime interop)
- HTTP transport mode: set `PORT` env var — `MCPServer` constructor detects and uses `StreamableHTTPServerTransport`

## Test pattern
SDK tests use the simple assert pattern:
```typescript
import assert from "node:assert";
// ...
assert.strictEqual(actual, expected, "description");
```
Run a single suite: `cd sdk && npx tsx tests/<name>.test.ts`
