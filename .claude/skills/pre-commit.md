# pre-commit

Run the full ShaleYeah pre-commit check suite. Use this before committing or opening a PR.

## Steps

Run the following commands in sequence from the repo root. Stop and report any failures immediately — do not continue to the next step if one fails.

```bash
npm run build && npm run type-check && npm run lint && npm run test && npm run demo
```

Report the result of each step clearly. If all pass, confirm the branch is ready to commit/push.
