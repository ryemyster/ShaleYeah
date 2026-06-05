# Local Testing — @shaleyeah/investment-chair

> **Status: Planned** — Not yet implemented. See [#367](https://github.com/ryemyster/ShaleYeah/issues/367).

## Once implemented

```bash
cd servers/decision && PORT=3013 pnpm start
# (new terminal)
cd agents/investment-chair
npx tsx tests/agent.test.ts
npx tsx tests/mcp-client.test.ts
```

## Testing the HITL gate

The `go_no_go` tool always triggers approval. In tests, always wire `onApprovalRequired`:

```typescript
const result = await runInvestmentChairTask(goal, {
    onApprovalRequired: async (challenge) => ({
        approved: true,
        reviewerId: "test-deal-team",
    }),
});
```

## Cost note

`deep-reasoning` routing uses `claude-opus-4-8`. For local testing, consider overriding `modelRouting` in the config to use `claude-haiku-4-5-20251001` for all tiers to control cost:

```typescript
const testConfig = {
    ...investmentChairConfig,
    modelRouting: {
        ...investmentChairConfig.modelRouting,
        "deep-reasoning": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    },
};
```
