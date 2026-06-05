# How It Works — @shaleyeah/research-analyst

> **Status: Planned** — Not yet implemented. See [#369](https://github.com/ryemyster/ShaleYeah/issues/369).

## The simple version (for a 12-year-old)

Before a company decides to drill in a new area, they want to know: has anyone else drilled here before? What happened? Are the neighbors doing well?

The **research analyst** is like a private investigator for oil and gas. It searches public permit databases, operator filings, and technical papers to find out what other companies have already learned. That way your company can learn from what worked and avoid what didn't — without having to reinvent the wheel.

## The technical version

1. **research server (Tier 1):** Queries public databases — state permit APIs, production databases, patent registries, technical journals. Structured search results.
2. **research-analyst agent (Tier 2):** ReAct loop — interprets the research question, sequences targeted searches, synthesizes findings into an intelligence package.

Permit searches use `small-fast` routing (deterministic lookups). Synthesis tasks use `standard-analysis`.
