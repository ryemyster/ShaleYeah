# code-review

Self-audit skill — run this after finishing implementation and before `/pre-commit`. Catches scope drift,
anti-patterns, missing tests, and comment quality issues before they land in a commit.

## Usage

`/code-review <issue-number>`

## Steps

### 1. Fetch issue scope

```bash
gh issue view <issue-number> --json title,body,labels
```

Extract the **acceptance criteria** and the list of files explicitly mentioned in the issue body.
This is the ground truth for what changed files are expected.

### 2. Scope alignment check

```bash
git diff --name-only develop
```

For each changed file, verify it appears in the issue's acceptance criteria or is a first-order
dependency (e.g., a test file for a changed source file, CHANGELOG.md, or a doc file required
by `/finish-issue`).

Flag any file that was modified but is NOT mentioned in the issue and NOT a first-order dependency.
These are scope creep candidates — they need explicit justification or should be reverted.

### 3. Anti-pattern scan

Run each grep. A result here is a violation — report it and stop the review as failed.

```bash
# Direct Anthropic SDK imports in server files (must route through llm-client.ts)
grep -rn "from '@anthropic-ai/sdk'\|from \"@anthropic-ai/sdk\"" src/servers/ 2>/dev/null

# Math.random() in business logic (must be deterministic — no random in servers or kernel)
# Exception: sampleUniform/sampleTriangular/sampleNormal in risk-analysis.ts are approved Monte Carlo samplers.
grep -rn "Math\.random()" src/servers/ src/kernel/ 2>/dev/null | grep -v "sampleUniform\|sampleTriangular\|sampleNormal\|function sample"

# z.any() in Zod schemas (masks type errors — use canonical schema sections instead)
# Note: pre-existing z.any() in risk-analysis.ts was the target of #208 and is now removed.
# New z.any() in any server file is a violation.
grep -rn "z\.any()" src/servers/ 2>/dev/null

# Silent numeric defaults — ?.field || 0 pattern hides missing upstream data
# These should be replaced with canonical context reads or explicit undefined checks.
grep -rn "?\..*|| 0\|?\..*|| \"\"\|?\..*|| \[\]" src/servers/ src/kernel/ 2>/dev/null | grep -v "test" | grep -v "node_modules"
```

If any grep returns results, list the file:line and explain why it violates the rule.

### 4. Ghost-close guard

Verify the primary new symbol (class, function, or type) mentioned in the issue acceptance criteria
actually exists in source:

```bash
# Example for canonical model:
grep -rn "WellAnalysisContextSchema\|mergeCanonical\|getCanonical" src/kernel/ 2>/dev/null
```

If the symbol is missing: STOP — do not proceed to pre-commit. The issue is not implemented.

### 5. Test coverage spot-check

For each new exported function or class added in this issue:
- Confirm there is at least one `assert` call in `tests/` that exercises it
- For kernel changes: confirm the test file is in `tests/kernel-*.test.ts`
- For server changes: confirm there is a corresponding anti-stub test or canonical model conformance test

```bash
# Check that canonical-model test exercises the new exports
grep -rn "WellAnalysisContextSchema\|mergeCanonical\|getCanonical" tests/ 2>/dev/null
```

### 6. Comment quality spot-check

Scan new lines (from the git diff) for what-not-why comments. Flag these patterns:

- `// set X` — describes the assignment, not why
- `// call X` — describes the invocation, not the intent
- `// return X` — describes the return, not the purpose
- `// check if` — describes the condition, not the business rule it enforces

```bash
git diff develop -- "*.ts" | grep "^+" | grep -E "^\+\s*//\s*(set |call |return |check if )" 2>/dev/null
```

Each flagged comment should be rewritten to explain *why* the code does what it does, not *what* it does.

### 7. Report

Output a summary:

```
Code Review — Issue #<n>: <title>
===========================================
Scope alignment:   ✅ All changed files are within issue scope
                   ❌ <file> not in issue scope — justify or revert

Anti-patterns:     ✅ No violations
                   ❌ <file>:<line> — <reason>

Ghost-close:       ✅ Primary symbols found in source
                   ❌ <symbol> not found — issue not implemented

Test coverage:     ✅ All new exports have test coverage
                   ❌ <export> has no test assertions

Comment quality:   ✅ No what-not-why comments found
                   ❌ <file>:<line> — rewrite comment

Overall: PASS | FAIL
```

If any check is ❌: do not run `/pre-commit`. Fix the issues first.
If all checks are ✅: proceed to `/pre-commit`.
