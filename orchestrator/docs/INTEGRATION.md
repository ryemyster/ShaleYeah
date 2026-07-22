# Integration — @shaleyeah/orchestrator

> **Status: Planned — #362**

## Who uses the orchestrator?

External callers — CLI tools, the ShaleYeah web application, and eventually a user-facing API. The orchestrator is the single entry point for a full deal workflow.

## Planned usage pattern

```typescript
import { DealWorkflowClient } from "@shaleyeah/orchestrator";

const client = new DealWorkflowClient();
const result = await client.runDealWorkflow({
    propertyName: "Permian Basin Acquisition",
    acreage: 2400,
    targetFormation: "Wolfcamp A",
});
// result: complete deal package with all 14 domain analyses + executive report
```

## Upstream dependencies

```
@shaleyeah/orchestrator
  └── Tier 2 agents (ports 4001–4014) via HTTP
  └── @shaleyeah/sdk (contracts)
  └── Temporal service
```

## Downstream consumers

The orchestrator is the top of the call chain — no upstream callers within the fleet.

## Current state

Stub only. See issue #362.
