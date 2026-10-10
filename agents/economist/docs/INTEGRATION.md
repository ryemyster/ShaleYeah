# Integration Guide — @shaleyeah/economist

> **Status: Planned** — Not yet implemented. See [#364](https://github.com/ryemyster/ShaleYeah/issues/364).

## Planned interface

Once implemented, the economist agent will expose the same interface as the geologist. Swap `geologist` for `economist`:

```typescript
import { runEconomistTask } from "@shaleyeah/economist";

const result = await runEconomistTask(
    "Run NPV and IRR analysis for a 10-well development with $5M/well capex at $70 WTI.",
    { apiKey: process.env.ANTHROPIC_API_KEY },
);
```

## HITL for financial outputs

Financial recommendations that trigger capital commitments should use `requiresHumanApproval: true`. Wire the callback:

```typescript
const result = await runEconomistTask(goal, {
    onApprovalRequired: async (challenge) => {
        // Present challenge.toolName and challenge.reason to a human reviewer
        return { approved: true, reviewerId: "ryan@company.com" };
    },
});
```

## Orchestrator integration

The investment-chair agent will call the economist as part of its synthesis loop. See `agents/investment-chair/docs/INTEGRATION.md` for the full fleet integration pattern.
