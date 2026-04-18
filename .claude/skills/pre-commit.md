# pre-commit

Run the full ShaleYeah pre-commit check suite. Use this before committing or opening a PR.

## Steps

Run the following in sequence from the repo root. Stop and report any failure immediately — do not continue to the next step if one fails.

### 1. Anti-pattern scan (fast — runs before the slow compile steps)

Rules and exceptions are defined in `CLAUDE.md ## Standards`. These greps enforce them:

```bash
# Rule: no direct Anthropic SDK imports in server files (see CLAUDE.md ## Standards)
grep -rn "from '@anthropic-ai/sdk'\|from \"@anthropic-ai/sdk\"" src/servers/ 2>/dev/null && echo "FAIL: direct SDK import in src/servers/" && exit 1 || true

# Rule: no Math.random() in business logic — exception: named Monte Carlo samplers in risk-analysis.ts (see CLAUDE.md ## Standards)
grep -rn "Math\.random()" src/servers/ src/kernel/ 2>/dev/null | grep -v "sampleUniform\|sampleTriangular\|sampleNormal\|function sample" && echo "FAIL: Math.random() in business logic" && exit 1 || true

# Rule: no z.any() in Zod schemas — exception: mcp-server.ts and server-factory.ts (see CLAUDE.md ## Standards)
grep -rn "z\.any()" src/servers/ src/kernel/ 2>/dev/null && echo "FAIL: z.any() in server or kernel — use explicit Zod types" && exit 1 || true

# Warning: ?.field || 0 silent defaults hide missing upstream data (see CLAUDE.md ## Standards)
grep -rn "\?\.\w\+[[:space:]]*||[[:space:]]*0\b" src/servers/ src/kernel/ 2>/dev/null | grep -v "node_modules\|\.test\." && echo "WARN: silent ?.field || 0 default found — verify intentional" || true
```

If any grep fires on a non-warning line: stop and report the file:line. Fix before proceeding. The `?.field || 0` check is a warning — report it but don't block if the use is intentional (document why).

### 2. Quality gate

```bash
npm run build && npm run type-check && npm run lint && npm run test && npm run demo
```

Report the result of each step clearly.

### 3. Coverage gate (90% line coverage required)

```bash
npm run coverage
```

This runs all test suites under `c8` and prints a summary table. The gate passes when:
- **Lines**: ≥ 90%
- **Functions**: ≥ 85%
- **Branches**: ≥ 80%

If coverage drops below threshold, identify the uncovered files from the report and add tests before proceeding. Do not commit with failing coverage.

If all checks pass, confirm the branch is ready to commit/push.
