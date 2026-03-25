# test-kernel

Run a specific kernel test file using `npx tsx`.

## Usage

`/test-kernel <name>`

Where `<name>` is the kernel test file suffix, e.g.:
- `/test-kernel resilience` → runs `tests/kernel-resilience.test.ts`
- `/test-kernel circuit-breaker` → runs `tests/kernel-circuit-breaker.test.ts`
- `/test-kernel executor` → runs `tests/kernel-executor.test.ts`

## Steps

Run: `npx tsx tests/kernel-<name>.test.ts`

If no name is given, list all available kernel test files:
```bash
ls tests/kernel-*.test.ts
```

Report pass/fail counts from the test output. If any tests fail, show the failing assertions.
