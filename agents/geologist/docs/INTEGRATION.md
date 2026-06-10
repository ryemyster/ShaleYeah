# Integration Guide — @shaleyeah/geologist

## Calling a single tool

Use `LocalAgentEndpoint` when you want standard HTTP API behavior (health check, discovery, execute):

```typescript
import { createGeologistEndpoint } from "@shaleyeah/geologist";

const endpoint = createGeologistEndpoint();
await endpoint.initialize();

const result = await endpoint.execute({
    toolName: "geologist.analyze_formation",
    args: { filePath: "/data/permian.las", analysisType: "comprehensive" },
    runId: "deal-001",
    grantedScopes: ["read:geology"],  // enables Permission Gate enforcement
});

if (result.status === "completed") {
    console.log(result.data);
} else if (result.status === "approval_required") {
    // HITL: a human needs to approve this call
    console.log(result.challenge);
} else {
    // result.status === "failed"
    console.error(result.error, "retryable:", result.retryable);
    // If retryable: true → transient error (network, server restart)
    // If retryable: false → permanent (bad args, unknown tool, missing scope, blocking eval)
}
```

## Running a multi-step task (natural language)

```typescript
import { runGeologistTask } from "@shaleyeah/geologist";

const answer = await runGeologistTask(
    "Analyze the Eagle Ford well logs in /data/ef-2024/ and summarize porosity and maturity.",
    {
        apiKey: process.env.ANTHROPIC_API_KEY,
        onApprovalRequired: async (challenge) => {
            // This fires when the agent wants to call save_finding (or any other
            // requiresHumanApproval tool). Present the challenge to an operator.
            console.log(`Approval needed: ${challenge.toolName}`, challenge.reason);
            return { approved: true, reviewerId: "ops-team", reason: "Approved for analysis" };
        },
    },
);

console.log(answer); // synthesized answer string
```

If `onApprovalRequired` is omitted and the agent tries to call `save_finding`, `runGeologistTask` will throw with a clear message asking you to provide the callback.

## Saving a finding (Learn step)

`geologist.save_finding` is the Memory component — it closes the Observe→Think→Act→**Learn** loop. It always requires human approval before persisting.

```typescript
// Direct tool call — approval_required is returned first
const challenge = await endpoint.execute({
    toolName: "geologist.save_finding",
    args: {
        findingType: "formation",
        title: "Permian Basin — Bone Spring Formation",
        summary: "12% porosity, 150ft net pay, Early Oil Window maturity",
        confidence: 0.85,
        dataSource: "/data/permian.las",
        metadata: { wellName: "ABC-101", basin: "Permian" },
    },
    runId: "deal-001-learning",
    grantedScopes: ["read:geology", "write:geology"],
});

// challenge.status === "approval_required"
// Re-execute with the operator approval token
const saved = await endpoint.execute({
    toolName: "geologist.save_finding",
    args: { ... }, // same args
    approval: { approved: true, reviewerId: "geo-lead", reason: "Verified against core data" },
    runId: "deal-001-learning",
    grantedScopes: ["read:geology", "write:geology"],
});

// saved.data → { findingId: "geo-1749...", stored: true, path: "./data/geowiz/findings/..." }
```

## Passing a caller-managed runtime

If you're calling the geologist from a larger orchestration loop and want to share a single initialized runtime:

```typescript
import { createGeologistRuntime, runGeologistTask } from "@shaleyeah/geologist";

const runtime = createGeologistRuntime(config);
await runtime.initialize();

// Re-use across multiple calls without re-initializing
const answer1 = await runGeologistTask(goal1, { runtime });
const answer2 = await runGeologistTask(goal2, { runtime });

await runtime.shutdown();
```

## Custom model routing (BYOE)

Override the operator model without forking the agent:

```typescript
import { createGeologistRuntime, geologistConfig } from "@shaleyeah/geologist";

const runtime = createGeologistRuntime({
    ...geologistConfig,
    modelRouting: {
        ...geologistConfig.modelRouting,
        "standard-analysis": {
            provider: "azure-openai",
            model: "gpt-4o",
        },
    },
});
```

The reasoning loop always resolves `config.modelRouting["standard-analysis"]` at call time, so config changes take effect immediately.

## Discovery

```typescript
const runtime = createGeologistRuntime();
await runtime.initialize();

// What this agent does
const summary = runtime.discover("summary");
// { id: "geologist", role: "geological-analyst", version: "0.1.0", ... }

// Available tools (9 total: 8 read + 1 write)
const tools = runtime.discover("tools");
// [{ name: "geologist.analyze_formation", type: "query", ... }, ...]

// Schema for one tool
const schema = runtime.discover("schema", "geologist.analyze_formation");
// { inputSchema: { ... }, ... }
```

## Health check

```typescript
const health = await runtime.health();
// { status: "ready" | "degraded" | "not_ready", checks: [...] }
```

## Scope requirements

| Scope | Required for |
|-------|-------------|
| `read:geology` | All 8 analysis tools |
| `write:geology` | `geologist.save_finding` |

Pass `grantedScopes` on every `execute()` call in production:

```typescript
await runtime.execute({
    toolName: "geologist.process_well_logs",
    args: { ... },
    grantedScopes: ["read:geology"],
});
```

When `grantedScopes` is omitted, the scope check is skipped (backward-compatible). If a required scope is absent and `grantedScopes` is provided, `execute()` returns `status: "failed"` with `error` naming the missing scope.

## Error handling

| `execResult.status` | Meaning | Action |
|-------------------|---------|--------|
| `"completed"` | Tool ran successfully | Use `result.data` |
| `"approval_required"` | HITL gate triggered (save_finding or autonomy=always) | Call your approval workflow, re-execute with `approval` token |
| `"failed"` + `retryable: true` | Transient (network, timeout) | `executeWithRetry` already retried 3× — geowiz may be down |
| `"failed"` + `retryable: false` | Permanent (bad args, missing scope, blocking eval, unknown tool) | Don't retry; fix the call |

Note: when calling `runGeologistTask`, retries are handled automatically inside `executeWithRetry()`. You only see the final result after all retry attempts are exhausted.

## Upstream connections (what geologist calls)

```
geologist → geowiz (port 3001)   via callGeowizTool / StreamableHTTPClientTransport
          → Anthropic Claude      via callLLM / ANTHROPIC_API_KEY
```

## Downstream connections (what calls geologist)

```
orchestrator (Temporal, #362)  → LocalAgentEndpoint.execute()
Claude Desktop / MCP clients   → LocalAgentEndpoint.execute()
runGeologistTask               → LocalAgentRuntime directly (in-process)
```

## Using from the orchestrator (#362)

When the Temporal orchestrator is implemented, it will call `LocalAgentEndpoint.execute()` via the `AgentRuntime` interface. No API changes are required — the endpoint already speaks the contract. Wire in a `workflowId` as `runId` and the audit trail will correlate entries across the workflow.

---

## See also

- [README](../README.md) — quick start, tool table, commands
- [ARCHITECTURE.md](ARCHITECTURE.md) — topology, execution paths, Arcade patterns
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — five-component framework, plain-language explanation
- [DEPLOYMENT.md](DEPLOYMENT.md) — production deployment, Docker, Kong, BYOE model routing
- [LOCAL_TESTING.md](LOCAL_TESTING.md) — running both processes locally, HITL testing
- [DEVELOPMENT.md](DEVELOPMENT.md) — TDD workflow, adding tools, implementation notes
