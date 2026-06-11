# Architecture — @shaleyeah/research-analyst

Implemented in [#369](https://github.com/ryemyster/ShaleYeah/issues/369).

## Topology

```
Orchestrator / Caller
        │
        ▼
┌────────────────────────────┐
│ @shaleyeah/research-analyst│  Tier 2 — LLM loop + governance (port 4008)
│  runResearchAnalystTask()  │  Arcade: Permission Gate, HITL, Timeout, Error Classification
└────────────┬───────────────┘
             │ HTTP  callResearchTool()
             ▼
┌────────────────────────┐
│ @shaleyeah/server-     │  Tier 1 — stateless tool server (port 3008)
│ research               │  src/tools/market-research.ts + competitive-analysis.ts
└────────────────────────┘
```

## Tools

| Tool | Type | Model | MCP Server |
|------|------|-------|------------|
| `research-analyst.conduct_market_research` | query | standard-analysis | research |
| `research-analyst.analyze_competition` | query | standard-analysis | research |

## Arcade patterns

| Pattern | Where |
|---------|-------|
| #46 Permission Gate | `LocalAgentRuntime.execute()` — every tool call |
| #28 Timeout Boundary | `callResearchTool` — configurable `timeoutMs` |
| #39 Recovery Guide | `callResearchTool` — structured error with hint |
| #40 Error Classification | `callResearchTool` — retryable vs permanent |
| HITL | `AgentRuntimeConfig.hitl` — `when-sensitive` default |

## Key files

| Path | Purpose |
|------|---------|
| `src/agent/index.ts` | Manifest, config, handlers, `runResearchAnalystTask` |
| `src/agent/research-client.ts` | MCP HTTP client with retry + error classification |
| `tests/mcp-client.test.ts` | 13 unit + integration tests |
| `tests/agent.test.ts` | 34 contract tests |
