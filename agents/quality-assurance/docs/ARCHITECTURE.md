# Architecture — @shaleyeah/quality-assurance

## Role

Tier 2 agent. Wraps the `@shaleyeah/server-qa` tool layer with agent-level intelligence: scope enforcement, model routing, HITL policy, eval scoring, and memory. The quality-assurance agent exposes the same 2 QA tools as qa-server, but with agent contracts enforced on top.

## Tool inventory

| Tool | Model requirement | HITL? | Eval profile |
|------|------------------|-------|-------------|
| `quality-assurance.run_quality_tests` | `standard-analysis` | No | `qa-run-tests` |
| `quality-assurance.generate_quality_report` | `deterministic` | No | `qa-generate-report` |

All tools require `read:qa` scope. None are destructive or require human approval — the quality-assurance agent only reads and validates data.

## How it differs from @shaleyeah/server-qa

The qa-server and the quality-assurance agent expose the same underlying functions, but at different layers:

| Concern | server-qa (Tier 1) | quality-assurance (Tier 2) |
|---------|-------------------|---------------------------|
| Transport | MCP over stdio | AgentRuntime (no transport) |
| Routing | None — receives tool calls | Routes to `standard-analysis` or `deterministic` model |
| HITL | None | Configured (currently off for all tools; can be enabled per tool) |
| Evals | None | Schema validation, secret redaction, confidence scoring |
| Memory | None | `@shaleyeah/sdk` memory layer (disabled by default) |
| Scopes | None | `read:qa` required on all calls |
| Autonomy | Always executes | `"reviewed"` — can be changed to `"assistive"` or `"autonomous"` |

## Execution path

```
quality-assurance.run_quality_tests { targets, testSuite }
  → AgentRuntime.execute()
    → scope check: "read:qa" required
    → handler: callQAServerTool() → qa-server over StreamableHTTPClientTransport
      (URL from AgentRuntimeConfig.mcpServers["qa-server"].url)
    → eval: schema + redactSecrets
    → AgentToolResult { status, data, evals, metadata }
```

## HITL policy (qaAssuranceConfig)

```
approvalMode: "when-sensitive"    — human review triggered on high-risk calls
requireForDestructive: true       — none of quality-assurance's tools are destructive
requireForMemoryPromotion: true   — any memory write requires review
```

## Model routing

```
"standard-analysis" → configured by operator (for QA synthesis and validation)
"deterministic"     → rule-based: no LLM call (report generation)
```

No provider names are hardcoded — the operator configures which models map to these capability labels via `AgentRuntimeConfig.modelRouting`.

## Memory policy

```
enabled: true              — memory system is wired
namespace: "quality-assurance"
vectorStore.enabled: false — vector memory off until a store is configured
retentionDays: 90
promotion.requireHumanReview: true
```

## Dependencies

```
@shaleyeah/quality-assurance
  ├── @shaleyeah/sdk                  (AgentManifest, AgentRuntime, contracts)
  └── @modelcontextprotocol/sdk       (StreamableHTTPClientTransport)
```

The quality-assurance agent does NOT depend on the orchestrator or any other agent. It can be deployed and tested in complete isolation from the rest of the fleet.
