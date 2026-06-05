# How It Works — @shaleyeah/investment-chair

> **Status: Planned** — Not yet implemented. See [#367](https://github.com/ryemyster/ShaleYeah/issues/367).

## The simple version (for a 12-year-old)

After all 13 other agents do their homework — the geologist, the accountant, the lawyer, the risk analyst — someone has to read all of it and say: "Should we do this deal or not?"

The **investment chair** is like the CEO of the agent team. It reads every report, weighs the pros and cons, and produces a clear recommendation: "Yes, drill — here's why" or "No, pass — here's what would need to change."

It never makes the final decision alone. It always asks a real human to approve before anything is committed — because spending $50 million needs a person in the loop.

## The technical version

1. **decision server (Tier 1):** Aggregates structured analysis packages, runs portfolio ranking algorithms, formats decision memos.
2. **investment-chair agent (Tier 2):** ReAct loop — ingests the full analysis package, synthesizes across domains, uses `deep-reasoning` model routing for all synthesis calls.

The `go_no_go` tool is `requiresHumanApproval: true` and `destructive: true`. The agent prepares the recommendation; a human must explicitly approve it before it is treated as an investment decision.

## What makes this agent different

Most agents in the fleet are domain experts — they go deep in one area. The investment chair goes wide — it must hold the full picture of geology, economics, risk, legal, market, and operations simultaneously and make a coherent judgment. This is why it defaults to `deep-reasoning` model routing.
