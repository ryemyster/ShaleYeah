# @shaleyeah/geologist

Marcus Aurelius Geologicus — the ShaleYeah fleet's geologist agent.

Tier 2 intelligence layer: wraps the Tier 1 geowiz MCP server's tools with agent-level reasoning, eval framework, and HITL controls.

## Quick start

```bash
pnpm start   # runs the agent's standalone runtime
```

## Building

```bash
pnpm build
pnpm test    # 35 tests
```

## Environment

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Required for synthesis calls |
