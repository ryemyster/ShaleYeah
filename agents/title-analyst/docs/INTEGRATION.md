# Integration Guide — @shaleyeah/title-analyst

> **Status: Planned** — Not yet implemented. See [#372](https://github.com/ryemyster/ShaleYeah/issues/372).

## Planned interface

```typescript
import { runTitleAnalystTask } from "@shaleyeah/title-analyst";

const result = await runTitleAnalystTask(
    "Research mineral ownership for Section 14, Township 32S, Range 27E in Lea County, NM.",
    {
        apiKey: process.env.ANTHROPIC_API_KEY,
        onApprovalRequired: async (challenge) => {
            // Required if title_opinion tool fires
            return { approved: true, reviewerId: "attorney@company.com" };
        },
    },
);
```

## Upstream / downstream

- **Upstream:** development-planner identifies the tracts; legal-analyst consumes title outputs for lease review
- **Downstream:** economist uses net revenue interest (NRI) in NPV calculations; investment-chair uses title status in decision package
