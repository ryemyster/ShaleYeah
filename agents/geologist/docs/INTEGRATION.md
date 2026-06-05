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
});

if (result.status === "completed") {
    console.log(result.data);
} else if (result.status === "approval_required") {
    // HITL: a human needs to approve this call
    console.log(result.challenge);
} else {
    // result.status === "failed"
    console.error(result.error, "retryable:", result.retryable);
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
            // Ask a human; return their decision
            return { approved: true, reviewerId: "ops-team", reason: "Approved for analysis" };
        },
    },
);

console.log(answer); // synthesized answer string
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

## Discovery

```typescript
const runtime = createGeologistRuntime();
await runtime.initialize();

// What this agent does
const summary = runtime.discover("summary");
// { id: "geologist", role: "geological-analyst", version: "0.1.0", ... }

// Available tools
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

All 8 geologist tools require `read:geology`. If your caller doesn't have this scope on the tool manifest, `execute()` will return `status: "failed"` with a clear error message.

Currently scope enforcement is declaration-only — the runtime checks that callers don't exceed the declared scope set. Fine-grained OAuth enforcement is a future addition tracked in the fleet auth roadmap.

## Error handling

| `execResult.status` | Meaning | Action |
|-------------------|---------|--------|
| `"completed"` | Tool ran successfully | Use `result.data` |
| `"approval_required"` | HITL gate triggered | Call your approval workflow, re-execute with `approval` token |
| `"failed"` + `retryable: true` | Transient (network, timeout) | Retry after short delay |
| `"failed"` + `retryable: false` | Permanent (bad args, auth, unknown tool) | Don't retry; fix the call |

## Using from the orchestrator (#362)

When the Temporal orchestrator is implemented, it will call `LocalAgentEndpoint.execute()` via the `AgentRuntime` interface. No API changes are required — the endpoint already speaks the contract. Wire in a `workflowId` as `runId` and the audit trail will correlate entries across the workflow.
