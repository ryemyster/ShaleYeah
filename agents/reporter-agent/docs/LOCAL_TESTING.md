# Local Testing — @shaleyeah/reporter-agent

> **Status: Planned** — Not yet implemented. See [#368](https://github.com/ryemyster/ShaleYeah/issues/368).

## Once implemented

```bash
cd servers/reporter && PORT=3009 pnpm start
# (new terminal)
cd agents/reporter-agent
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```

## Testing HITL for file writes

```typescript
// onApprovalRequired is required when any file-write tool fires
const result = await runReporterAgentTask(goal, {
    onApprovalRequired: async (challenge) => ({ approved: true, reviewerId: "test-user" }),
});
```
