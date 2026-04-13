---
paths:
  - "src/servers/**/*.ts"
  - "tests/*-anti-stub.test.ts"
---

# Server Implementation Rules

All 14 MCP servers follow the same pattern. When editing any server:

## Structure
- Inherit `MCPServer` from `src/shared/mcp-server.ts`
- Roman persona in the class docstring (e.g., "Marcus Aurelius Geologicus")
- Register tools via `registerTool()` — never expose methods directly
- All LLM calls go through `src/shared/llm-client.ts` — no direct `@anthropic-ai/sdk` calls in server files

## LLM wiring pattern
Every server that calls Claude must have:
1. `synthesize<Domain>WithLLM(input, apiKey?)` — calls `callLLM()`, returns structured result
2. `deriveDefault<Domain>()` — rule-based fallback, deterministic, no randomness
3. The tool handler calls `synthesize*` and catches errors, falling back to `deriveDefault*`

```typescript
try {
  return await synthesizeWithLLM(input);
} catch (_err) {
  // LLM unavailable (no key, network down) — fall back to rule-based estimate
  return deriveDefault(input);
}
```

## Anti-stub test requirement
Every server with `callLLM` wired must have a corresponding `tests/<server>-anti-stub.test.ts`
that proves `messages.create` is actually called (use a fake API key to get an auth error).

## No Math.random()
Fallback functions must produce deterministic output — use real domain constants, not random values.
