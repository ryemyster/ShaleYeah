# How It Works — @shaleyeah/title-analyst

> **Status: Planned** — Not yet implemented. See [#372](https://github.com/ryemyster/ShaleYeah/issues/372).

## The simple version (for a 12-year-old)

Before an oil company can drill, they need to make sure they actually have permission from the right people. Underground minerals can be owned by completely different people than the surface land. The original owner might have sold the land but kept the oil rights 100 years ago, and now nobody knows exactly who owns what.

The **title analyst** is like a historical detective. It goes through old records and county filings to trace who owned the oil rights at every step, figure out what fees and royalties have to be paid, and flag anything that looks wrong or unclear before the company spends millions drilling.

## The technical version

1. **title server (Tier 1):** Searches county records, state databases, and deed repositories. Parses ownership chains and burden structures.
2. **title-analyst agent (Tier 2):** ReAct loop — traces ownership from current holder back to source, identifies encumbrances and defects, assembles a title summary.

`title_opinion` requires human approval — it produces a legal deliverable that a licensed attorney must review before it is relied upon.
