# Integration Guide — @shaleyeah/development-planner

> **Status: Planned** — Not yet implemented. See [#373](https://github.com/ryemyster/ShaleYeah/issues/373).

## Planned interface

```typescript
import { runDevelopmentPlannerTask } from "@shaleyeah/development-planner";

const result = await runDevelopmentPlannerTask(
    "Design a 20-well development plan for a 640-acre section in the Midland Basin, targeting the Wolfcamp A.",
    { apiKey: process.env.ANTHROPIC_API_KEY },
);
```

## Upstream / downstream

- **Upstream:** reservoir-engineer provides type curves; geologist provides formation tops and thickness
- **Downstream:** drilling-engineer consumes well locations for wellbore design; infrastructure-planner consumes pad locations for facilities planning; economist uses drill schedule for capital budgeting
