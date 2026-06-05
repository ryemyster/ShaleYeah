# Integration Guide — @shaleyeah/infrastructure-planner

> **Status: Planned** — Not yet implemented. See [#375](https://github.com/ryemyster/ShaleYeah/issues/375).

## Planned interface

```typescript
import { runInfrastructurePlannerTask } from "@shaleyeah/infrastructure-planner";

const result = await runInfrastructurePlannerTask(
    "Size the gathering system for a 20-well pad program producing 5,000 BOE/day at peak.",
    { apiKey: process.env.ANTHROPIC_API_KEY },
);
```

## Upstream / downstream

- **Upstream:** development-planner provides pad locations and production forecasts
- **Downstream:** economist consumes facilities CAPEX for total project cost; development-planner uses infrastructure schedule to constrain drilling pace; investment-chair uses infrastructure cost in decision package
