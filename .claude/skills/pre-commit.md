# pre-commit

Run the full ShaleYeah pre-commit check suite. Use this before committing or opening a PR.

## Steps

Run the following commands in sequence from the repo root. Stop and report any failures immediately — do not continue to the next step if one fails.

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
```

If either grep fires: stop and report the file:line. Fix before proceeding.

### 2. Quality gate

```bash
npm run build && npm run type-check && npm run lint && npm run test && npm run demo
```

Report the result of each step clearly. If all pass, confirm the branch is ready to commit/push.
