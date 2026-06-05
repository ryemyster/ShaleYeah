# Integration Guide — @shaleyeah/risk-analyst

> **Status: Planned** — Not yet implemented. See [#366](https://github.com/ryemyster/ShaleYeah/issues/366).

## Planned interface

```typescript
import { runRiskAnalystTask } from "@shaleyeah/risk-analyst";

const result = await runRiskAnalystTask(
    "Run a Monte Carlo analysis on a 10-well program. P10/P50/P90 EUR = 200/350/600 Mboe, cost = $4-6M/well.",
    { apiKey: process.env.ANTHROPIC_API_KEY },
);
```

## Upstream / downstream

- **Upstream:** economist provides deterministic NPV inputs; geologist provides EUR range estimates
- **Downstream:** investment-chair consumes risked values and probability distributions for final decision
