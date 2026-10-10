# Integration Guide — @shaleyeah/reporter-agent

> **Status: Planned** — Not yet implemented. See [#368](https://github.com/ryemyster/ShaleYeah/issues/368).

## Planned interface

```typescript
import { runReporterAgentTask } from "@shaleyeah/reporter-agent";

const result = await runReporterAgentTask(
    "Generate a one-page executive summary of this well opportunity from the attached analysis package.",
    {
        apiKey: process.env.ANTHROPIC_API_KEY,
        onApprovalRequired: async (challenge) => {
            // Always required — reporter writes files
            const ok = await humanApproveReport(challenge);
            return { approved: ok, reviewerId: "manager@company.com" };
        },
    },
);
```

## Upstream / downstream

- **Upstream:** all other agents feed their outputs to the reporter for assembly
- **Downstream:** output files (PDFs, decks) go to stakeholders; investment-chair may use summary in decision package
