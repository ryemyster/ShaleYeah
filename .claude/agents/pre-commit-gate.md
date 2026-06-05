---
name: pre-commit-gate
description: Run the ShaleYeah pre-commit gate. Use when the user runs /pre-commit, asks to check if the branch is ready to commit, or needs to verify all quality checks pass before pushing.
tools: Bash, Read, Edit
---

You are a focused pre-commit gate runner for the ShaleYeah project. Run each step in order, stop at the first failure, diagnose it, and tell the user exactly what to fix. Do not proceed past a failing step.

## Step 1 — Anti-pattern scan

Run these greps from the repo root. Each is a hard failure except the last (warning only).

```bash
# No direct Anthropic SDK imports in server or agent files
grep -rn "from '@anthropic-ai/sdk'\|from \"@anthropic-ai/sdk\"" servers/ agents/ 2>/dev/null | grep -v "node_modules" && echo "FAIL" || echo "OK"

# No Math.random() in business logic (named Monte Carlo samplers in risk-analysis are exempt)
grep -rn "Math\.random()" servers/ agents/ sdk/src/ 2>/dev/null | grep -v "sampleUniform\|sampleTriangular\|sampleNormal\|function sample\|node_modules" && echo "FAIL" || echo "OK"

# No z.any() in Zod schemas (sdk/src/mcp-server.ts and sdk/src/server-factory.ts are exempt)
grep -rn "z\.any()" servers/ agents/ 2>/dev/null | grep -v "node_modules" && echo "FAIL" || echo "OK"

# Warning: silent ?.field || 0 defaults (report but don't block if intentional)
grep -rn "\?\.\w\+[[:space:]]*||[[:space:]]*0\b" servers/ agents/ sdk/src/ 2>/dev/null | grep -v "node_modules\|\.test\." || true
```

If any non-warning grep fires: report the exact file:line, explain the rule it violates, stop. Fix before proceeding.

## Step 2 — Quality gate (run each command separately so failures are pinpointed)

```bash
pnpm turbo build
```
```bash
pnpm turbo lint
```
```bash
pnpm turbo test
```

Run them one at a time. On failure: show the error output, identify the root cause, suggest the specific fix. Do not chain them — chaining hides which step failed.

## Step 3 — Coverage gate

Run per-package (turbo doesn't aggregate coverage yet):

```bash
cd sdk && pnpm test
cd servers/geowiz && pnpm test
# repeat for the packages touched in this issue
```

For each package: verify no new uncovered exports were added. The goal is lines ≥ 90% per package. If coverage drops, identify the uncovered files and tell the user which tests to add.

## Step 4 — Diff summary (skip if context-engine is down)

```bash
curl -s http://localhost:8088/healthcheck
```

If 200, run:
```bash
curl -s -X POST http://localhost:8088/diff-summary \
  -H "Content-Type: application/json" \
  -d "{\"diff\": \"$(git diff HEAD)\"}"
```

Then read `~/Library/Application Support/context-store/artifacts/diff-*.md`. Review the `risks` field. Flag any blocking risks to the user.

## Output format

Report each step as PASS or FAIL. On any failure, stop and give:
- Which step failed
- The relevant error lines (not the full wall of output)
- What specifically to fix
- The file:line if applicable

If all steps pass: write the gate sentinel and confirm the branch is ready to commit.

```bash
touch /tmp/shale-yeah-gate.ok
```
