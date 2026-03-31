# create-issue

Scaffold and create a well-formed GitHub issue following ShaleYeah's TDD/SDLC standards.

## Usage

`/create-issue <title> [tier] [server]`

Examples:
- `/create-issue "Wire Anthropic SDK — shared LLM client" tier-1`
- `/create-issue "EIA API integration for market.ts" tier-1 market`
- `/create-issue "Real Monte Carlo simulation in risk-analysis" tier-1 risk-analysis`

## Steps

1. **Draft the issue body** using this template:

```markdown
## Problem
<What is wrong or missing? Be specific — name files, functions, line numbers.>

## Acceptance Criteria
- [ ] <Specific, testable outcome 1>
- [ ] <Specific, testable outcome 2>
- [ ] All pre-commit checks pass (`npm run build && npm run type-check && npm run lint && npm run test && npm run demo`)

## TDD Checklist
- [ ] Write failing test first (describe what the real implementation should return)
- [ ] Implement real logic (no Math.random(), no mock bypasses)
- [ ] Integration test passes with real inputs (or mocked SDK in CI)
- [ ] Demo mode still passes with deterministic fixture data

## Context
<Why does this matter? What does it unlock? Which issues does it block or depend on?>

## Out of Scope
<What is explicitly NOT part of this issue?>
```

2. **Apply labels** — Use `gh issue create` with appropriate labels:
   - `tier-1`, `tier-2`, `tier-3`, or `tier-4`
   - `tdd`
   - `server:<name>` if targeting a specific server (e.g. `server:market`, `server:risk-analysis`)

3. **Create the issue**:
```bash
gh issue create --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)" --label "tier-1,tdd"
```

4. **Report the issue URL and number** when done.

## Rules

- Every issue must have at least 2 acceptance criteria and a full TDD checklist.
- Never create an issue for work that is already done or in-progress without noting that in the body.
- If the issue depends on another issue, note it explicitly: `Depends on #<number>`.
