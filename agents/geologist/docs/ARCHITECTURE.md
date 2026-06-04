# Architecture — @shaleyeah/geologist

## Role

Tier 2 agent. Wraps the `@shaleyeah/server-geowiz` tool layer with agent-level intelligence: scope enforcement, model routing, HITL policy, eval scoring, and memory. The geologist agent exposes the same 8 geological tools as geowiz, but with agent contracts enforced on top.

## Tool inventory

| Tool | Model requirement | HITL? | Eval profile |
|------|------------------|-------|-------------|
| `geologist.analyze_formation` | `standard-analysis` | No | `geologist-formation` |
| `geologist.process_gis` | `deterministic` | No | — |
| `geologist.process_well_logs` | `standard-analysis` | No | `geologist-well-log` |
| `geologist.assess_quality` | `deterministic` | No | — |
| `geologist.process_access_database` | `deterministic` | No | — |
| `geologist.process_document` | `standard-analysis` | No | `geologist-document` |
| `geologist.process_seismic_data` | `standard-analysis` | No | `geologist-seismic` |
| `geologist.process_aries_database` | `standard-analysis` | No | `geologist-aries` |

All tools require `read:geology` scope. None are destructive or require human approval — the geologist only reads data.

## How it differs from @shaleyeah/server-geowiz

The geowiz server and the geologist agent expose the same underlying functions, but at different layers:

| Concern | server-geowiz (Tier 1) | geologist (Tier 2) |
|---------|----------------------|-------------------|
| Transport | MCP over stdio | AgentRuntime (no transport) |
| Routing | None — receives tool calls | Routes to `standard-analysis` or `deterministic` model |
| HITL | None | Configured (currently off for all tools; can be enabled per tool) |
| Evals | None | Schema validation, secret redaction, confidence scoring |
| Memory | None | `@shaleyeah/sdk` memory layer (disabled by default) |
| Scopes | None | `read:geology` required on all calls |
| Autonomy | Always executes | `"reviewed"` — can be changed to `"assistive"` or `"autonomous"` |

## Execution path

```
geologist.analyze_formation { filePath, formations }
  → AgentRuntime.execute()
    → scope check: "read:geology" required
    → handler: calls performFormationAnalysis() from @shaleyeah/server-geowiz
      (TypeScript import — no MCP transport in this path)
    → eval: schema + redactSecrets
    → AgentToolResult { status, data, evals, metadata }
```

No MCP transport is used when the agent calls geowiz internally. The MCP layer on geowiz is only active when an external client (Claude Desktop, etc.) connects to geowiz directly.

## HITL policy (geologistConfig)

```
approvalMode: "when-sensitive"    — human review triggered on high-risk calls
requireForDestructive: true       — none of geologist's tools are destructive
requireForMemoryPromotion: true   — any memory write requires review
```

## Model routing

```
"small-fast"        → configured by operator (for low-stakes metadata)
"standard-analysis" → configured by operator (for formation/well-log analysis)
"deep-reasoning"    → configured by operator (reserved for complex interpretations)
"deterministic"     → rule-based: no LLM call (GIS processing, quality assessment)
```

No provider names are hardcoded — the operator configures which models map to these capability labels via `AgentRuntimeConfig.modelRouting`.

## Memory policy

Disabled by default:
```
enabled: true              — memory system is wired
namespace: "geologist"
vectorStore.enabled: false — vector memory off until a store is configured
retentionDays: 90
promotion.requireHumanReview: true
```

## Dependencies

```
@shaleyeah/geologist
  ├── @shaleyeah/sdk           (AgentManifest, AgentRuntime, contracts)
  └── @shaleyeah/server-geowiz (performFormationAnalysis, processEnhancedGIS, etc.)
```

The geologist does NOT depend on the orchestrator or any other agent. It can be deployed and tested in complete isolation from the rest of the fleet.
