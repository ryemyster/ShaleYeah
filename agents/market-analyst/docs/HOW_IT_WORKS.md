# How It Works — @shaleyeah/market-analyst

> **Status: Planned** — Not yet implemented. See [#371](https://github.com/ryemyster/ShaleYeah/issues/371).

## The simple version (for a 12-year-old)

Oil and gas prices go up and down like a roller coaster. Companies need to know: what's the price today, what might it be next year, and how can they protect themselves if it drops?

The **market analyst** watches the commodity markets like a weather forecaster watches the sky. It tracks oil and gas prices, figures out whether you're getting a fair price at your specific location (some places get less because they're far from buyers), and suggests ways to lock in a good price now in case prices drop later.

## The technical version

1. **market server (Tier 1):** Fetches and analyzes commodity price data, basis differentials, forward curves, and comparable transaction metrics.
2. **market-analyst agent (Tier 2):** ReAct loop — interprets market questions, sequences the right lookups and calculations, produces a market intelligence summary.
