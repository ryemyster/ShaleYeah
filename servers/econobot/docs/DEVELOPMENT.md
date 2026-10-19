# Developing Econobot

```sh
pnpm build
pnpm type-check
pnpm lint
pnpm test
```

Run these inside servers/econobot. Test coverage must stay at least 90%.
The test command runs numerical fixtures, actual tool handlers and a generic
MCP client against the built entry from an independent working directory.

Write a failing numerical or protocol test before behavior changes. Add new
math to the single cash-flow calculator, retaining explicit units and
availability states. Check NPV at a reported IRR and use independent published
examples. Never weaken error cases to accept a guessed successful result.

Keep optional model interpretation outside numerical truth. Tests inject the
shared call interface for successful/failing provider responses and exercise
the actual adapter's missing-credential guard without paid keys or live requests.
Human review and investment authority cannot be granted through model prose.
