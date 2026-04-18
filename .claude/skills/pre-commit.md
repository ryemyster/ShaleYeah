# pre-commit

Run the full ShaleYeah pre-commit check suite. Use this before committing or opening a PR.

## Steps

Run the following in sequence from the repo root. Stop and report any failure immediately — do not continue to the next step if one fails.

### 1. Anti-pattern scan (fast — runs before the slow compile steps)

```bash
# Detect direct Anthropic SDK imports in server files.
# All LLM calls must route through src/shared/llm-client.ts — direct imports bypass the shared client.
grep -rn "from '@anthropic-ai/sdk'\|from \"@anthropic-ai/sdk\"" src/servers/ 2>/dev/null && echo "FAIL: direct SDK import in src/servers/" && exit 1 || true

# Detect Math.random() in business logic.
# Servers and kernel must be deterministic — Math.random() produces unreproducible results.
# Exception: distribution samplers in risk-analysis.ts Monte Carlo (sampleUniform, sampleTriangular, sampleNormal)
# are intentional — they are clearly named and tested. All other uses are violations.
grep -rn "Math\.random()" src/servers/ src/kernel/ 2>/dev/null | grep -v "sampleUniform\|sampleTriangular\|sampleNormal\|function sample" && echo "FAIL: Math.random() in business logic" && exit 1 || true

# Detect z.any() in Zod schemas.
# z.any() masks type errors and defeats strict-mode guarantees — use explicit canonical schema types.
# Exception: src/shared/mcp-server.ts and src/shared/server-factory.ts use it for Zod runtime interop.
grep -rn "z\.any()" src/servers/ src/kernel/ 2>/dev/null && echo "FAIL: z.any() in server or kernel — use explicit Zod types" && exit 1 || true

# Detect silent numeric defaults — ?.field || 0 hides missing upstream data and produces wrong NPV/IRR silently.
# Replace with canonical context reads (session.getCanonical()) or explicit undefined checks.
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
