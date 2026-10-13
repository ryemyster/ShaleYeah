# Architecture — @shaleyeah/quality-assurance

## Role

Tier 2 agent. Wraps the `@shaleyeah/server-qa` tool layer with agent-level intelligence: scope enforcement, model routing, HITL policy, eval scoring, and memory. The quality-assurance agent exposes the same 2 QA tools as qa-server, but with agent contracts enforced on top.

This page describes the current TypeScript runtime. The researched
[employee charter](ROLE.md) specifies business-data checks, private context,
source evidence and revision-bound human review. Its proposed mode is
Stand-alone Agent with Progressive Disclosure (Skills), with deterministic rule
results and review transitions. #716 owns observed server rule results; #542
owns the ADK/Python employee and removes the displaced runtime. Existing tests
do not establish the charter's job quality or authenticated backend authority.

## Tool inventory

| Tool | Model requirement | HITL? | Eval profile |
|------|------------------|-------|-------------|
| `quality-assurance.run_quality_tests` | `standard-analysis` | No | `qa-run-tests` |
| `quality-assurance.generate_quality_report` | `deterministic` | No | `qa-generate-report` |

Both employee tools declare `read:qa` and currently leave tool approval off.
The observed QA backend accepts exact task/profile/result references, enforces
`qa:read`, `qa:run` and `qa:report` plus source grants, and stores only private
immutable draft results. It exposes no arbitrary output path. The current
employee argument/scopes do not yet match that boundary; use the server directly
until #542 completes employee integration.
The charter permits scoped draft artifacts and requires authenticated review
for source edits, critical waivers, final acceptance and external publication.

## How it differs from @shaleyeah/server-qa

The qa-server and the quality-assurance agent expose the same underlying functions, but at different layers:

| Concern | server-qa (Tier 1) | quality-assurance (Tier 2) |
|---------|-------------------|---------------------------|
| Transport | MCP over stdio or configured HTTP | AgentRuntime delegates through an HTTP MCP client |
| Routing | None — receives tool calls | Routes to `standard-analysis` or `deterministic` model |
| HITL | No waiver/acceptance/publication action; data owner reviews elsewhere | Configured (currently off for all tools; can be enabled per tool) |
| Evals | Configured observed-rule fixtures and detection scorecard | Schema validation, secret redaction, confidence scoring |
| Memory | No employee working context | `@shaleyeah/sdk` memory namespace; durable/scoped context remains unqualified |
| Scopes | Authenticated task/profile/source grants and `qa:*` scopes | `read:qa` required on all calls |
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
requireForDestructive: true       — tools currently lack destructive classification despite optional artifact writes
requireForMemoryPromotion: true   — configured promotion policy; current task-context writes do not prove enforcement
```

## Model routing

```
"standard-analysis" → configured by operator (for QA synthesis and validation)
"deterministic"     → rule-based: no LLM call (report generation)
```

The operator can configure capability labels through `AgentRuntimeConfig.modelRouting`.
Current employee defaults select Anthropic models; its provider path still
needs #542 qualification. The server uses deterministic observed checks and
recorded reports; optional triage uses an explicit shared BYO synthesis profile
and native provider adapter, without changing the verdict.

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
