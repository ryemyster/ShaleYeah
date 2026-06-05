# Architecture — @shaleyeah/geologist

## Topology

```
Caller (orchestrator / Claude Desktop / test)
  │
  ▼
LocalAgentEndpoint          ← HTTP service layer (AgentService)
  │
  ▼
LocalAgentRuntime           ← Permission Gate: HITL + scope + audit (Arcade #46, #48)
  │
  ▼
StandaloneToolHandler       ← handler map: "geologist.*" → callGeowizTool()
  │
  ▼  MCP/HTTP  (StreamableHTTPClientTransport)
  ▼
geowiz MCP server           ← Tier 1: pure tool implementation
  (servers/geowiz, port 3001)
```

## Two-tier separation

| Concern | geowiz (Tier 1) | geologist (Tier 2) |
|---------|----------------|-------------------|
| Transport | MCP over HTTP | AgentRuntime contracts |
| Auth / scopes | None | `read:geology` required on all calls |
| HITL | None | Configurable per tool; `when-sensitive` default |
| Audit | None | Every `execute()` logged (timestamp, duration, retryable) |
| Model routing | None | `standard-analysis` / `deterministic` capability labels |
| Evals | None | Schema blocking, secret-redaction blocking |
| Retry signal | Throws generic Error | `RetryableToolError` vs `PermanentToolError` |
| Memory | None | Namespace `"geologist"` (vector store deferred — #395) |

## Tool inventory

| Tool | Model requirement | Destructive | HITL | Eval profile |
|------|------------------|-------------|------|-------------|
| `geologist.analyze_formation` | `standard-analysis` | No | No | `geologist-formation` |
| `geologist.process_gis` | `deterministic` | No | No | — |
| `geologist.process_well_logs` | `standard-analysis` | No | No | `geologist-well-log` |
| `geologist.assess_quality` | `deterministic` | No | No | — |
| `geologist.process_access_database` | `deterministic` | No | No | — |
| `geologist.process_document` | `standard-analysis` | No | No | `geologist-document` |
| `geologist.process_seismic_data` | `standard-analysis` | No | No | `geologist-seismic` |
| `geologist.process_aries_database` | `standard-analysis` | No | No | `geologist-aries` |

All tools require `read:geology` scope. None are destructive.

## Execution path — single tool call

```
runtime.execute({ toolName: "geologist.analyze_formation", args, runId })
  1. findTool()        — manifest lookup; unknown tool → status: "failed"
  2. approvalChallengeFor() — HITL gate; returns challenge if approval required
  3. modelRouting check — no route configured → status: "failed"
  4. handler()         — calls callGeowizTool(url, "analyze_formation", args)
     ├── StreamableHTTPClientTransport → geowiz POST /mcp
     ├── Promise.race(callPromise, timeoutPromise)   — 30s default timeout
     ├── network error → RetryableToolError
     └── other error   → PermanentToolError
  5. evaluate()        — schema check + secret-redaction check
  6. audit()           — writes JSON entry to stderr (or operator-supplied logger)
  → AgentExecutionResult { status: "completed" | "failed", data, evals, metadata }
```

## Execution path — runGeologistTask (Layer 2 loop)

```
runGeologistTask(goal, options)
  1. createGeologistRuntime()  — initialize runtime (handlers, model routing)
  2. callLLM(system, history)  — ReAct step: LLM returns JSON tool call or done
  3. runtime.execute()         — Permission Gate fires on every step
     ├── completed → push tool result to history
     ├── approval_required → call onApprovalRequired callback (or throw)
     └── failed → push error + retryability hint to history
  4. repeat up to MAX_STEPS=8
  5. force-synthesis pass if max steps reached
  6. runtime.shutdown()
```

## Arcade patterns implemented

| Pattern | # | Where |
|---------|---|-------|
| Timeout Boundary | 28 | `geowiz-client.ts` — `Promise.race()` 30s default |
| Async Job (stub) | 24 | `index.ts` TODO #396 |
| Error Classification | 40 | `geowiz-client.ts` — `RetryableToolError` / `PermanentToolError` |
| Context Injection (stub) | 37 | `index.ts` TODO #395 |
| Permission Gate | 46 | `runtime.execute()` — HITL + scope on every call |
| Audit Trail | 48 | `runtime.ts` — `auditLogger` hook, default stderr JSON |

## Package dependencies

```
@shaleyeah/geologist
  ├── @shaleyeah/sdk              (AgentManifest, LocalAgentRuntime, contracts, errors)
  └── @modelcontextprotocol/sdk   (StreamableHTTPClientTransport, Client)

Runtime peer dependency (not in package.json):
  └── @shaleyeah/server-geowiz    (must be running at GEOWIZ_MCP_URL)
```

The geologist does NOT depend on the orchestrator or any other agent and can be deployed in complete isolation.
