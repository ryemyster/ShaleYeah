---
paths:
  - "src/kernel/**/*.ts"
  - "tests/kernel-*.test.ts"
---

# Kernel Implementation Rules

The kernel (`src/kernel/`) is the runtime that routes all execution. Its 6 files have distinct roles:

| File | Role |
|---|---|
| `index.ts` | Kernel class — entry point, middleware pipeline, high-level methods |
| `registry.ts` | Tool registry — 14 servers, capability matching, type classification |
| `executor.ts` | Execution engine — single, parallel scatter-gather, bundles, confirmation gate |
| `context.ts` | Session manager — identity anchoring, context injection, result storage |
| `bundles.ts` | Pre-built task bundles (QUICK_SCREEN, FULL_DUE_DILIGENCE, etc.) |
| `middleware/` | auth.ts (RBAC), audit.ts (JSONL trail), resilience.ts, output.ts |

## Rules
- All kernel types live in `types.ts` — do not define new types inline in implementation files
- Middleware runs in order: auth → audit → resilience → output. New middleware inserts here.
- `executor.ts` handles all retry/fallback logic — servers never retry themselves
- `context.ts` owns session state — do not store state in the Kernel class directly
- `secrets.ts` owns secret resolution — `kernel.secrets.resolve(key)` is the only access path

## Test pattern
Kernel tests use the simple assert pattern:
```typescript
import assert from "node:assert";
// ...
assert.strictEqual(actual, expected, "description");
```
Run a single suite: `npx tsx tests/kernel-<name>.test.ts`
