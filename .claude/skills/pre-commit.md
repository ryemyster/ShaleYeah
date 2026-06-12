# pre-commit

Run the full ShaleYeah pre-commit check suite. Use this before committing or opening a PR.

## Steps

Run the following in sequence from the repo root. Stop and report any failure immediately — do not continue to the next step if one fails.

### 1. Anti-pattern scan (fast — runs before the slow compile steps)

Rules and exceptions are defined in `CLAUDE.md ## Standards`. These greps enforce them:

```bash
# Rule: no direct Anthropic SDK imports in server or agent files (see CLAUDE.md ## Standards)
grep -rn "from '@anthropic-ai/sdk'\|from \"@anthropic-ai/sdk\"" servers/ agents/ 2>/dev/null | grep -v node_modules && echo "FAIL: direct SDK import" && exit 1 || true

# Rule: no Math.random() in business logic — exception: named Monte Carlo samplers in risk-analysis (see CLAUDE.md ## Standards)
grep -rn "Math\.random()" servers/ agents/ sdk/src/ 2>/dev/null | grep -v "sampleUniform\|sampleTriangular\|sampleNormal\|function sample\|node_modules" && echo "FAIL: Math.random() in business logic" && exit 1 || true

# Rule: no z.any() in Zod schemas — exception: sdk/src/mcp-server.ts and sdk/src/server-factory.ts (see CLAUDE.md ## Standards)
grep -rn "z\.any()" servers/ agents/ 2>/dev/null | grep -v node_modules && echo "FAIL: z.any() in server or agent — use explicit Zod types" && exit 1 || true

# Warning: ?.field || 0 silent defaults hide missing upstream data (see CLAUDE.md ## Standards)
grep -rn "\?\.\w\+[[:space:]]*||[[:space:]]*0\b" servers/ agents/ sdk/src/ 2>/dev/null | grep -v "node_modules\|\.test\." && echo "WARN: silent ?.field || 0 default found — verify intentional" || true
```

If any grep fires on a non-warning line: stop and report the file:line. Fix before proceeding. The `?.field || 0` check is a warning — report it but don't block if the use is intentional (document why).

### 2. Quality gate

```bash
pnpm turbo build
pnpm turbo lint
pnpm turbo test
```

Run each separately. Report the result of each step clearly.

### 3. Coverage gate (per package, 90% line coverage required)

Run for each package touched in this issue:

```bash
cd <package> && pnpm test
```

Verify no new uncovered exports. The goal is lines ≥ 90% per package. If coverage drops, identify the uncovered files from the report and add tests before proceeding. Do not commit with failing coverage.

### 4. Diff summary via context-engine (run after all checks pass)

Use the `review_diff` MCP tool with the output of `git diff HEAD`. Review the `risks` field from the result — if any risk is flagged, address it before committing. Skip if the engine is unreachable.

If all checks pass and no blocking risks are flagged, write the gate sentinel and confirm the branch is ready to commit/push.

```bash
touch /tmp/shale-yeah-gate.ok
```
