# Local Testing — @shaleyeah/geologist + geowiz

The geologist agent and geowiz server form a **pair**: the agent (Tier 2) calls the server (Tier 1) over MCP/HTTP. Local testing runs both processes simultaneously.

## 1. Start the geowiz server

```bash
# Terminal 1 — Tier 1 server
cd servers/geowiz
PORT=3001 pnpm start
# ✅ geowiz v0.1.0 initialized
# 🚀 Marcus Aurelius Geologicus ready
```

## 2. Run the unit tests (no API key needed)

```bash
# Terminal 2
cd agents/geologist
npx tsx tests/agent.test.ts         # 27 contract tests
npx tsx tests/mcp-client.test.ts    # 12 tests (integration tests now run)
```

When geowiz is running, the previously-skipped integration test fires:

```
✓ [integration] callGeowizTool routes assess_quality through geowiz MCP
```

## 3. Run a live task

```bash
# Terminal 2 (geowiz still running in terminal 1)
ANTHROPIC_API_KEY=sk-ant-... node --input-type=module << 'TASKEOF'
import { runGeologistTask } from "./dist/agent/index.js";
const answer = await runGeologistTask(
    "Assess the quality of a sample LAS file and summarize what you find.",
    { apiKey: process.env.ANTHROPIC_API_KEY },
);
console.log(answer);
TASKEOF
```

## 4. Watch the audit log

Every `execute()` call writes a JSON line to stderr. Pipe stderr to pretty-print:

```bash
ANTHROPIC_API_KEY=sk-ant-... node --input-type=module ... 2>&1 \
  | grep '^{' | jq .
```

Example audit entry:

```json
{
  "timestamp": "2026-06-05T03:15:26.968Z",
  "agentId": "geologist",
  "toolName": "geologist.analyze_formation",
  "args": { "filePath": "sample.las" },
  "status": "completed",
  "durationMs": 312
}
```

## 5. Test HITL behavior

```typescript
import { createGeologistRuntime, geologistConfig } from "./dist/agent/index.js";

const runtime = createGeologistRuntime({
    ...geologistConfig,
    hitl: { ...geologistConfig.hitl, approvalMode: "always" },
});
await runtime.initialize();

// Should return approval_required
const result = await runtime.execute({
    toolName: "geologist.analyze_formation",
    args: { filePath: "sample.las" },
});
console.log(result.status); // "approval_required"

// Re-execute with approval token
const approved = await runtime.execute({
    toolName: "geologist.analyze_formation",
    args: { filePath: "sample.las" },
    approval: { approved: true, reviewerId: "test-user" },
});
console.log(approved.status); // "completed"
```

## 6. Test error classification

```typescript
import { callGeowizTool } from "./dist/agent/geowiz-client.js";
import { RetryableToolError } from "@shaleyeah/sdk";

// Stop geowiz first, then:
try {
    await callGeowizTool("http://localhost:3001", "analyze_formation", { filePath: "x.las" });
} catch (err) {
    console.log(err instanceof RetryableToolError); // true — ECONNREFUSED is retryable
}
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED localhost:3001` | geowiz not running | `cd servers/geowiz && PORT=3001 pnpm start` |
| `Error: ANTHROPIC_API_KEY is required` | Missing env var | Set `ANTHROPIC_API_KEY` |
| `Missing model route for standard-analysis` | Config missing routing | Check `geologistConfig.modelRouting` |
| Tests show ⚠️ skip warnings | Live geowiz not running | Normal — unit tests pass without the server |

---

## See also

- [README](../README.md) — quick start, tool table, commands
- [ARCHITECTURE.md](ARCHITECTURE.md) — topology, execution paths, Arcade patterns
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — five-component framework, plain-language explanation
- [INTEGRATION.md](INTEGRATION.md) — calling this agent from your code
- [DEPLOYMENT.md](DEPLOYMENT.md) — production deployment, Docker, Kong, BYOE model routing
- [DEVELOPMENT.md](DEVELOPMENT.md) — TDD workflow, adding tools, implementation notes
