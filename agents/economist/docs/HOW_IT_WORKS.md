# How It Works — @shaleyeah/economist

> **Status: Planned** — Not yet implemented. See [#364](https://github.com/ryemyster/ShaleYeah/issues/364).

## The simple version (for a 12-year-old)

Imagine you found a treasure chest that might have gold inside — but it costs money to dig it up. Should you spend the money or not?

The **economist** is like a really smart accountant who does the math for you. You tell it: "here's how much oil we think is there, here's the current price, here's what it costs to drill." It runs all the numbers and tells you whether the treasure is worth more than the digging costs.

It also answers hard questions like:
- "What if the oil price drops by 20% — do we still make money?"
- "How long until we get our investment back?"
- "Which of these three projects makes the most money?"

## The technical version

The economist agent follows the same two-piece design as every other SHALE YEAH agent:

1. **econobot server (Tier 1):** Runs financial calculations — NPV, IRR, sensitivity analysis. Pure math, no opinions. Takes structured inputs, returns numbers.
2. **economist agent (Tier 2):** Runs the ReAct loop — reads the question, picks the right calculations, calls the server, synthesizes the results into an answer.

The agent never bypasses the governance layer. Every server call goes through `LocalAgentRuntime.execute()`, which checks permissions and logs what happened.

## What it can't do (yet)

- Pull live commodity prices (needs market-analyst integration)
- Model tax structures or royalty burdens
- Run portfolio optimization across multiple projects
