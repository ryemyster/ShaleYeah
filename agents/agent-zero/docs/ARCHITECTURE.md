# Architecture — @shaleyeah/agent-zero

## Role

Agent Zero is not a domain expert — it is the **reference contract implementation**. It proves the `AgentManifest` / `AgentRuntime` contracts work end-to-end before any specialist agent migrates onto them. Every new agent migration issue (#363-376) should look at agent-zero first to understand what a complete, correct agent looks like.

## Tools

| Tool | Type | Requires HITL? | Model requirement |
|------|------|---------------|-----------------|
| `agent-zero.inspect` | `query` | No | `small-fast` |
| `agent-zero.promote_memory` | `command` | Yes (`requiresHumanApproval: true`) | `small-fast` |

`inspect` — read-only, demonstrates progressive discovery, model routing, and eval scoring.  
`promote_memory` — demonstrates HITL: returns `approval_required` challenge first, completes only after `approval.approved: true` is passed back.

## What it proves

| Contract area | Covered by |
|--------------|-----------|
| Manifest validation (Zod) | `AgentManifestSchema.safeParse(agentZeroManifest)` |
| Config validation (Zod) | `AgentRuntimeConfigSchema.safeParse(agentZeroConfig)` |
| Progressive discovery (summary / tools / schema) | `runtime.discover()` |
| Organization-owned model routing | `agentZeroConfig.modelRouting` — capability labels, not provider names |
| HITL challenge before memory write | `promote_memory` returns `approval_required` |
| Secret redaction in eval | `redactSecrets` eval strips `apiKey`, `bearerToken` from input before handler |
| `approvalMode: "never"` semantics | Tool-level `requiresHumanApproval: true` overrides operator config |
| Transport-neutral endpoint | `createAgentZeroEndpoint()` — health, manifest, schema, execute |

## Runtime config highlights

```
autonomy: "reviewed"
hitl.approvalMode: "when-sensitive"
hitl.requireForMemoryPromotion: true
evals.checks.redactSecrets: "blocking"
memory.promotion.requireHumanReview: true
mcpServers: {}            — no Tier 1 servers wired (domain-free by design)
dataConnectors: {}
```

## What it is NOT

Agent Zero does not call any domain server, does not analyze O&G data, and does not have a production use case. It exists only to validate the SDK contracts. When `agents/geologist/` is the reference for domain agent architecture, agent-zero is the reference for SDK contract correctness.

## Dependencies

```
@shaleyeah/agent-zero
  └── @shaleyeah/sdk  (AgentManifest, AgentRuntime, AgentService, all contracts)
```
