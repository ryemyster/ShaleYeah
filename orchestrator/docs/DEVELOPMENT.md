# Development — @shaleyeah/orchestrator

> **Status: Planned — #362**

## Current state

This package is a stub. Do not add business logic until issue #362 is worked.

## Setup (stub)

```bash
cd orchestrator
pnpm install && pnpm build
```

## When #362 is implemented

### Dependencies to add

```bash
pnpm add @temporalio/client @temporalio/worker @temporalio/workflow
```

### File layout (planned)

```
orchestrator/src/
  workflows/
    deal-workflow.ts     ← DealWorkflow definition
    bid-workflow.ts      ← BidWorkflow definition
  activities/
    agent-activities.ts  ← HTTP calls to Tier 2 agents
  worker.ts              ← Temporal worker startup
  client.ts              ← Workflow client for external callers
  index.ts               ← Public exports
```

### Key constraints

- Workflows must be deterministic — no `Date.now()`, `Math.random()`, or direct I/O inside workflow functions
- All side effects (HTTP calls to agents) must be in Activity functions
- Use `@shaleyeah/sdk` contracts for type safety — do not re-declare AgentManifest shapes

## Linting

```bash
cd orchestrator && npx biome check src/
```
