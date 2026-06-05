# @shaleyeah/quality-assurance

Testius Validatus — the ShaleYeah fleet's quality assurance agent.

Tier 2 intelligence layer: wraps the Tier 1 qa-server MCP server's tools with agent-level reasoning, eval framework, and HITL controls.

## Quick start

```bash
pnpm start   # runs the agent's standalone runtime
```

## Building

```bash
pnpm build
pnpm test    # 42 tests
```

## Environment

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Required for synthesis calls |
