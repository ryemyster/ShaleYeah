# Integration Guide — @shaleyeah/investment-chair

> **Status: Planned** — Not yet implemented. See [#367](https://github.com/ryemyster/ShaleYeah/issues/367).

## Planned interface

```typescript
import { runInvestmentChairTask } from "@shaleyeah/investment-chair";

// Pass the aggregated analysis package from all upstream agents
const result = await runInvestmentChairTask(
    `Evaluate this opportunity and provide a go/no-go recommendation.
     Geology: ${geologistReport}
     Economics: ${economistReport}
     Risk: ${riskReport}
     Legal: ${legalReport}
     Market: ${marketReport}`,
    {
        apiKey: process.env.ANTHROPIC_API_KEY,
        onApprovalRequired: async (challenge) => {
            // Always fires for go_no_go — this is the human-in-the-loop checkpoint
            const decision = await presentToDealTeam(challenge);
            return { approved: decision.approved, reviewerId: decision.reviewerId };
        },
    },
);
```

## Fleet integration (orchestrator pattern)

The investment chair is the terminal node in the fleet. The orchestrator (#362, Temporal workflows) will:

1. Fan out to all domain agents in parallel
2. Collect structured outputs
3. Call investment-chair with the aggregated package
4. Surface the go/no-go recommendation to the deal team

See `ARCHITECTURE.md` (root) for the full fleet topology.
