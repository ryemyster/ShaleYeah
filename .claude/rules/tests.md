---
paths:
  - "tests/**/*.test.ts"
---

# Test Rules

## Pattern
All tests use Node's built-in `assert` module — no jest, no vitest:

```typescript
import assert from "node:assert";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  // run, catch, report
}
```

Run any test file directly: `npx tsx tests/<name>.test.ts`

## CI constraint
Tests must pass without `ANTHROPIC_API_KEY`. Mock the Anthropic SDK:

```typescript
process.env.ANTHROPIC_API_KEY = "";
// or use a fake key to trigger an auth error as proof callLLM was invoked
```

## Key-gated tests
Tests that require a real API key must check and skip gracefully:

```typescript
const HAS_API_KEY = !!process.env.ANTHROPIC_API_KEY;
if (!HAS_API_KEY) {
  console.log("⏭ [SKIPPED] requires ANTHROPIC_API_KEY");
  return;
}
```

## Anti-stub tests
Every server with `callLLM` wired needs a test that proves `messages.create` is called.
Use an invalid API key — the resulting auth error confirms the real SDK path was hit.

## LAS parser known quirks
- `parseLASFile()` is synchronous — do not `await` it
- Curve properties use `.name` not `.mnemonic`
- `depth_start`/`depth_stop` may parse as NaN — derive depth from DEPT curve `.data` array instead
