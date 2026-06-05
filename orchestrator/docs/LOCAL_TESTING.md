# Local Testing — @shaleyeah/orchestrator

> **Status: Planned — #362**

## Current state

This package is a stub. No tests exist yet. See issue #362.

## Build the stub

```bash
cd orchestrator
pnpm build
```

## When #362 is implemented

### Prerequisites

Start a local Temporal dev server:

```bash
brew install temporal
temporal server start-dev
```

### Run the worker

```bash
TEMPORAL_ADDRESS=localhost:7233 pnpm start
```

### Run workflow tests

```bash
npx tsx tests/deal-workflow.test.ts
```

### Test without Temporal (unit test activities)

```typescript
import { runDealActivities } from "../src/activities/agent-activities.js";
// Call activity functions directly — no Temporal worker needed
```

## Common issues (planned)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Connection refused :7233` | Temporal not running | `temporal server start-dev` |
| Workflow non-determinism error | Side effect in workflow function | Move to Activity |
| Agent call failures | Agent servers not running | Start all 14 agent services |
