# Integration Guide — @shaleyeah/drilling-engineer

> **Status: Planned** — Not yet implemented. See [#374](https://github.com/ryemyster/ShaleYeah/issues/374).

## Planned interface

```typescript
import { runDrillingEngineerTask } from "@shaleyeah/drilling-engineer";

const result = await runDrillingEngineerTask(
    "Design a wellbore program for a 10,000 ft vertical well in the Permian Basin.",
    { apiKey: process.env.ANTHROPIC_API_KEY },
);
```

## Upstream / downstream

- **Upstream:** development-planner passes target well locations
- **Downstream:** economist consumes AFE estimates for NPV modeling
- **Fleet coordinator:** investment-chair synthesizes drilling program into final decision
