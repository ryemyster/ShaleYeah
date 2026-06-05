# Integration Guide — @shaleyeah/legal-analyst

> **Status: Planned** — Not yet implemented. See [#370](https://github.com/ryemyster/ShaleYeah/issues/370).

## Planned interface

```typescript
import { runLegalAnalystTask } from "@shaleyeah/legal-analyst";

const result = await runLegalAnalystTask(
    "Review this lease agreement and flag any unusual royalty provisions or depth restrictions.",
    {
        apiKey: process.env.ANTHROPIC_API_KEY,
        onApprovalRequired: async (challenge) => {
            // Required if any contract modification tools are called
            return { approved: true, reviewerId: "counsel@company.com" };
        },
    },
);
```

## Upstream / downstream

- **Upstream:** title-analyst provides ownership context; development-planner provides lease tract boundaries
- **Downstream:** investment-chair consumes legal risk summary in final decision package
