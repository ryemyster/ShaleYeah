# How It Works — @shaleyeah/reporter-agent

> **Status: Planned** — Not yet implemented. See [#368](https://github.com/ryemyster/ShaleYeah/issues/368).

## The simple version (for a 12-year-old)

After all the scientists and engineers do their work, someone has to write it all up in a way that bosses and investors can read. That's a lot of work — summarizing hundreds of pages into a few slides.

The **reporter** does that writing for you. You give it all the analysis (the geology, the economics, the risks), and it assembles a clean, professional report or slide deck. It still asks a human to approve before it saves anything — because you don't want a report going out with mistakes.

## The technical version

1. **reporter server (Tier 1):** Assembles structured report content from analysis inputs — summaries, tables, charts, slide content.
2. **reporter-agent agent (Tier 2):** ReAct loop — takes analysis outputs from other agents, sequences the right report-building tools, produces a deliverable.

File-writing tools (`build_well_deck`, `export_report`) are `destructive: true` with `requiresHumanApproval: true`. The agent can draft and preview without approval; it only writes files after a human confirms.
