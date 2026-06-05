# Integration Guide — @shaleyeah/research-analyst

> **Status: Planned** — Not yet implemented. See [#369](https://github.com/ryemyster/ShaleYeah/issues/369).

## Planned interface

```typescript
import { runResearchAnalystTask } from "@shaleyeah/research-analyst";

const result = await runResearchAnalystTask(
    "Find all horizontal wells drilled in Reeves County, TX by Diamondback Energy in 2024.",
    { apiKey: process.env.ANTHROPIC_API_KEY },
);
```

## Upstream / downstream

- **Upstream:** geologist requests analogous well data; development-planner requests competitor spacing patterns
- **Downstream:** reporter-agent uses research packages in report assembly; investment-chair uses competitive intelligence
