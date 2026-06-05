# How It Works — @shaleyeah/risk-analyst

> **Status: Planned** — Not yet implemented. See [#366](https://github.com/ryemyster/ShaleYeah/issues/366).

## The simple version (for a 12-year-old)

When you flip a coin, you know there's a 50% chance of heads. But in oil and gas, the "coin" has thousands of sides — oil prices, how much oil is really there, drilling costs, government rules.

The **risk analyst** is like a very fast gambler who flips that coin a million times in a computer simulation (called Monte Carlo). By running all those simulations, it can tell you: "There's a 90% chance this project makes money, and a 10% chance you lose everything — but here's what that loss looks like."

## The technical version

1. **risk-analysis server (Tier 1):** Runs Monte Carlo simulations using triangular, uniform, and normal distributions. Uses `Math.random()` intentionally — this is the one place in SHALE YEAH where randomness is the point.
2. **risk-analyst agent (Tier 2):** ReAct loop — interprets the risk question, defines the input distributions based on domain knowledge, calls the server, interprets the output distribution into a risk narrative.

`project_ranking` uses `deep-reasoning` routing because comparing correlated multi-variable portfolios requires deeper inference than simple tool calls.
