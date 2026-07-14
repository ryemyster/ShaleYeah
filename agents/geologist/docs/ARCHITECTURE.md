# Architecture — @shaleyeah/geologist

## ADK target shape

`agents/geologist` is now the package-local ADK project for the Geologist role. The monorepo root remains workspace coordination only.

Package-local ADK files:

| File | Purpose |
|------|---------|
| `agents-cli-manifest.yaml` | agents-cli project marker for this package |
| `.agents-cli-spec.md` | reference-pair spec and package boundary |
| `pyproject.toml` | Python ADK project dependencies |
| `app/agent.py` | ADK `root_agent` and Geowiz backend-selection tools |

Migration classification:

| Path | Classification | Rationale |
|------|----------------|-----------|
| `app/agent.py` | keep | Target ADK authoring surface for Geologist reasoning and tool selection |
| `src/agent/index.ts` | adapter | Existing custom runtime remains only until ADK owns direct MCP execution and eval flow |
| `src/agent/geowiz-client.ts` | adapter | Existing MCP HTTP client is the live execution path until replaced by ADK MCP client code |
| `servers/geowiz` | keep | Independent MCP backend; must not depend on this agent |

New agent runtime behavior should be added to the ADK path first. The TypeScript adapter should shrink as ADK feature parity lands.

## Topology

```
Caller (orchestrator / Claude Desktop / test)
  │
  ▼
LocalAgentEndpoint          ← HTTP service layer (AgentService)
  │
  ▼
LocalAgentRuntime           ← Permission Gate: scope check + HITL + blocking evals + audit (Arcade #46, #48)
  │
  ▼
executeWithRetry()          ← Exponential backoff on RetryableToolError (Arcade #40)
  │
  ▼
StandaloneToolHandler       ← handler map: "geologist.*" → callGeowizTool()
  │
  ▼  MCP/HTTP  (StreamableHTTPClientTransport)
  ▼
geowiz MCP server           ← Tier 1: pure tool implementation
  (servers/geowiz, port 3001)
  GET /health               ← JSON health probe (no MCP session required)
```

## Five agent components

| Component | Implementation |
|-----------|---------------|
| **Goal** | `geologistManifest` — role, capabilities, tool inventory |
| **Perception** | `callGeowizTool` reads well logs, GIS, seismic, documents, databases |
| **Reasoning** | `executeLoop` — ReAct loop; `callLLM` with `standard-analysis` model from `modelRouting` |
| **Action** | `runtime.execute()` — HITL gate, scope enforcement, evals fire on every tool call |
| **Memory** | `geologist.save_finding` → geowiz findings store (local JSON now, pgvector when #405 ships) |

## Two-tier separation

| Concern | geowiz (Tier 1) | geologist (Tier 2) |
|---------|----------------|-------------------|
| Transport | MCP over HTTP | AgentRuntime contracts |
| Auth / scopes | None | `read:geology` / `write:geology` enforced when `grantedScopes` provided |
| HITL | None | Configurable per tool; `when-sensitive` default; `save_finding` always requires approval |
| Audit | None | Every `execute()` logged (timestamp, duration, retryable) |
| Model routing | None | `standard-analysis` / `deterministic` capability labels → real model IDs at runtime |
| Evals | None | Schema blocking (halts on failure), secret-redaction blocking |
| Retry signal | Throws network errors | `RetryableToolError` triggers backoff in `executeWithRetry()` |
| Memory | `save_finding` persists JSON | Agent calls `geologist.save_finding` to promote findings |

## Tool inventory

| Tool | Type | Model requirement | Scopes | HITL | Eval profile |
|------|------|------------------|--------|------|-------------|
| `geologist.analyze_formation` | query | `standard-analysis` | `read:geology` | No | `geologist-formation` |
| `geologist.process_gis` | query | `deterministic` | `read:geology` | No | — |
| `geologist.process_well_logs` | query | `standard-analysis` | `read:geology` | No | `geologist-well-log` |
| `geologist.assess_quality` | query | `deterministic` | `read:geology` | No | — |
| `geologist.process_access_database` | query | `deterministic` | `read:geology` | No | — |
| `geologist.process_document` | query | `standard-analysis` | `read:geology` | No | `geologist-document` |
| `geologist.process_seismic_data` | query | `standard-analysis` | `read:geology` | No | `geologist-seismic` |
| `geologist.process_aries_database` | query | `standard-analysis` | `read:geology` | No | `geologist-aries` |
| `geologist.save_finding` | **command** | `deterministic` | **`write:geology`** | **Yes** | — |

## Execution path — single tool call

```
runtime.execute({ toolName, args, runId, grantedScopes? })
  1. findTool()             — manifest lookup; unknown tool → status: "failed"
  2. scopeCheck()           — if grantedScopes provided, tool.requiredScopes ⊆ grantedScopes; else skip
  3. approvalChallengeFor() — HITL gate; returns challenge if tool.requiresHumanApproval or autonomy="always"
  4. modelRouting check     — no route for tool.modelRequirement → status: "failed"
  5. handler()              — calls callGeowizTool(url, toolName, args)
     ├── StreamableHTTPClientTransport → geowiz POST /mcp
     ├── Promise.race(callPromise, timeoutPromise)  — 30s default timeout
     ├── network error → RetryableToolError
     └── other error   → PermanentToolError
  6. evaluate()             — schema check + secret-redaction check
  7. blockingFailureCheck() — any blocking eval fail → status: "failed", retryable: false
  8. audit()                — writes JSON entry to stderr (or operator-supplied logger)
  → AgentExecutionResult { status: "completed" | "failed" | "approval_required" }
```

## Execution path — runGeologistTask (Layer 2 loop)

```
runGeologistTask(goal, options)
  1. createGeologistRuntime(config)    — initialize runtime (handlers, model routing)
  2. resolve reasoningModel            — config.modelRouting["standard-analysis"].model
  3. callLLM(system, history, model)   — ReAct step: LLM returns JSON tool call or done
  4. executeWithRetry(runtime, req)    — Permission Gate + backoff for RetryableToolError
     ├── completed → push tool result to history
     ├── approval_required → call onApprovalRequired callback (or throw)
     └── failed (permanent) → push error hint to history
  5. repeat up to MAX_STEPS=8
  6. force-synthesis pass if max steps reached
  7. runtime.shutdown()
```

## Model routing

`geologistConfig.modelRouting` ships with Anthropic dev defaults. Operators override at deploy time:

| Capability label | Dev default | Operator override path |
|-----------------|-------------|----------------------|
| `standard-analysis` | `claude-sonnet-4-6` | `ANTHROPIC_MODEL_STANDARD` or config injection |
| `deep-reasoning` | `claude-opus-4-8` | `ANTHROPIC_MODEL_DEEP` or config injection |
| `small-fast` | `claude-haiku-4-5-20251001` | `ANTHROPIC_MODEL_FAST` or config injection |
| `local-private` | `claude-haiku-4-5-20251001` | Any Ollama/private endpoint |
| `deterministic` | `rule-based / no-model` | No override — handler is always deterministic |

The reasoning loop (`executeLoop`) always uses `standard-analysis`. Tool-level `modelRequirement` is surfaced in metadata and will route tool-internal LLM calls when #402 is fully propagated to all agents.

## Arcade patterns implemented

| Pattern | # | Where |
|---------|---|-------|
| Timeout Boundary | 28 | `geowiz-client.ts` — `Promise.race()` 30s default |
| Async Job (stub) | 24 | `index.ts` TODO #396 |
| Error Classification | 40 | `geowiz-client.ts` — `RetryableToolError` / `PermanentToolError` |
| **Retry with Backoff** | 40 | `executeWithRetry()` — 500ms × 2^attempt, MAX_TOOL_RETRIES=3 |
| Context Injection (stub) | 37 | `index.ts` TODO #395 |
| Permission Gate | 46 | `runtime.execute()` — scope check + HITL + blocking eval halt |
| Audit Trail | 48 | `runtime.ts` — `auditLogger` hook, default stderr JSON |
| **Transactional Boundary** | 26 | `executeLoop` — permanent write failure pushes "rolled back — do not retry" to history instead of exiting loop; `save_finding` marked `transactional: true` |
| **Compensation Handler** | 27 | `sdk/src/compensation.ts` `CompensationRegistry` — `executeLoop` calls registered undo fn before rollback message; `save_finding` has a stub handler (active undo deferred to #405) |
| **GUI URL** | 33 | `sdk/src/types.ts` `wrapWithGuiUrl()` — `analyze_formation` wraps its response in `ToolResponseEnvelope<T>` when `DASHBOARD_BASE_URL` is set; `executeLoop` system prompt instructs the agent to surface `viewUrl` as a clickable link |

## Adding a command (write) tool

When adding any tool with `readOnly: false` to this agent:

1. Mark `transactional: true` in the tool manifest (Arcade #26). This routes permanent failures through the rollback path in `executeLoop`, surfacing partial state to the LLM instead of a silent exit.
2. Register a `CompensationRegistry` handler (Arcade #27) so `executeLoop` can attempt to undo any partially-written state before informing the LLM. Import `CompensationRegistry` from `@shaleyeah/sdk` and call `CompensationRegistry.register("agent.tool_name", async (args) => { ... })` near the handler map.
3. Add `requiresHumanApproval: true` for tools that write to persistent storage — users should confirm saves.
4. Add `requiredScopes: ["write:<domain>"]` and ensure the manifest `requiredScopes` superset is updated.
5. Add tests covering: compensation fn called on failure; compensation throws → error in history, loop continues; no handler → rollback message unchanged.

`save_finding` is the reference implementation — see `src/agent/index.ts` and `tests/transactional-boundary.test.ts`.

## Package dependencies

```
@shaleyeah/geologist
  ├── @shaleyeah/sdk              (AgentManifest, LocalAgentRuntime, contracts, errors)
  └── @modelcontextprotocol/sdk   (StreamableHTTPClientTransport, Client)

Runtime peer dependency (not in package.json):
  └── @shaleyeah/server-geowiz    (must be running at GEOWIZ_MCP_URL)
```

The geologist does NOT depend on the orchestrator or any other agent and can be deployed in complete isolation.

---

## See also

- [README](../README.md) — quick start, tool table, commands
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — five-component framework, plain-language explanation
- [INTEGRATION.md](INTEGRATION.md) — calling this agent from your code
- [DEPLOYMENT.md](DEPLOYMENT.md) — production deployment, Docker, Kong, BYOE model routing
- [LOCAL_TESTING.md](LOCAL_TESTING.md) — running both processes locally, HITL testing
- [DEVELOPMENT.md](DEVELOPMENT.md) — TDD workflow, adding tools, implementation notes
