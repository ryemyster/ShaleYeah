# How It Works — @shaleyeah/legal-analyst

> **Status: Planned** — Not yet implemented. See [#370](https://github.com/ryemyster/ShaleYeah/issues/370).

## The simple version (for a 12-year-old)

When you borrow your friend's bike, you agree to the rules: bring it back by 5pm, don't ride it in the mud. Oil and gas has the same thing, but with hundreds of pages of rules written by lawyers.

The **legal analyst** reads all those pages so you don't have to. You give it a lease or a contract and it tells you: "Here's what you're allowed to do. Here's what you have to pay. Here's the stuff that could get you in trouble."

If there's something risky in the contract, it flags it for a human to decide. It never makes legal decisions on its own — it finds the issues, you decide what to do.

## The technical version

1. **legal server (Tier 1):** Parses legal documents, extracts clauses, runs compliance checks, identifies standard vs. non-standard terms.
2. **legal-analyst agent (Tier 2):** ReAct loop — reads the legal question, sequences document extraction and risk identification calls, synthesizes a risk summary.

`redline_contract` is the only command-type tool and requires human approval (`requiresHumanApproval: true`) — the agent surfaces proposed changes, a human approves before they're applied.
