# Integration Guide — @shaleyeah/market-analyst

> **Status: Planned** — Not yet implemented. See [#371](https://github.com/ryemyster/ShaleYeah/issues/371).

## Planned interface

```typescript
import { runMarketAnalystTask } from "@shaleyeah/market-analyst";

const result = await runMarketAnalystTask(
    "What is the current WTI/Midland basis, and what hedging strategy would protect a 10,000 BOE/day producer at $65 WTI?",
    { apiKey: process.env.ANTHROPIC_API_KEY },
);
```

## Upstream / downstream

- **Upstream:** research-analyst provides intelligence on competitor activity; external data APIs (EIA, CME)
- **Downstream:** economist consumes price assumptions and basis differentials for NPV modeling; investment-chair uses hedge coverage in decision package
