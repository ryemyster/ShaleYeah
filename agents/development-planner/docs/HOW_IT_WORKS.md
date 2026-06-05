# How It Works — @shaleyeah/development-planner

> **Status: Planned** — Not yet implemented. See [#373](https://github.com/ryemyster/ShaleYeah/issues/373).

## The simple version (for a 12-year-old)

Imagine you own a big farm and you want to put in 50 apple trees. You can't just plant them anywhere — they need enough space so their roots don't fight each other, and you want to pick them in a smart order so you're not hauling bushels from the wrong side every day.

The **development planner** does the same thing for oil wells. It figures out the best places to put each well, how far apart they should be so they don't steal oil from each other, and what order to drill them in so you spend money wisely.

## The technical version

1. **development server (Tier 1):** Runs well spacing optimization, pad placement geometry, infill screening, and phased development scheduling.
2. **development-planner agent (Tier 2):** ReAct loop — takes reservoir and economic constraints, sequences the right spatial and scheduling calculations, produces a field development plan.

`development_schedule` uses `deep-reasoning` because it involves multi-constraint optimization (capital pacing, rig availability, infrastructure readiness).
