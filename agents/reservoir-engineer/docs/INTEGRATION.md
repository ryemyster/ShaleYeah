# Integration Guide — @shaleyeah/reservoir-engineer

The retained TypeScript interface calls Curve Smith through the stateless MCP
connection described in the [package README](../README.md#mcp-connection).
The complete ADK/Python employee workflow remains assigned to #681.

## Planned interface

```typescript
import { runReservoirEngineerTask } from "@shaleyeah/reservoir-engineer";

const result = await runReservoirEngineerTask(
    "Fit a decline curve to the attached production history and estimate EUR.",
    { apiKey: process.env.ANTHROPIC_API_KEY },
);
```

## Upstream / downstream

- **Upstream:** geologist provides formation data that informs reservoir inputs
- **Downstream:** economist consumes EUR and production forecasts for NPV modeling
- **Fleet coordinator:** development-planner uses well-level forecasts to design the field development
