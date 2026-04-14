# Glossary — Oil & Gas, Investing, and How SHALE YEAH Handles It

If you're new to oil and gas or investment analysis, this page explains the terms you'll see in the code and reports. Each entry answers three questions:

1. **What is it?** — a plain-English explanation
1. **Why does it matter?** — what goes wrong if you ignore it
1. **How does SHALE YEAH handle it?** — which agent deals with it and what the code does

---

## Oil & Gas Terms

### LAS File (Log ASCII Standard)

**What is it?**
A LAS file is a text file that contains measurements taken inside a well as a drill bit or sensor is lowered down the borehole. Think of it as an X-ray of the underground rock. A typical LAS file has columns for depth (in feet) and measurements like gamma ray (tells you if it's shale or sand), porosity (how much empty space is in the rock), and bulk density.

**Why does it matter?**
Without well log data, you're guessing what's underground. The LAS file is the primary evidence for how good the rock is. A well with high porosity in the target zone is much more likely to produce oil or gas than one with low porosity.

**How does SHALE YEAH handle it?**
The `geowiz` agent ([src/servers/geowiz.ts](../src/servers/geowiz.ts)) reads LAS files using the parser in `src/shared/parsers/`. It extracts depth, porosity, and density measurements, computes averages across the target zone, and feeds those numbers to Claude to get a geological recommendation.

---

### Formation / Zone / Interval

**What is it?**
Underground rock is layered like a cake. Each distinct layer is called a "formation." Geologists give formations names — "Wolfcamp A," "Wolfcamp B," "Austin Chalk," "Bone Spring" — based on where they were first described or what they're made of. When someone says they're drilling to "the Wolfcamp," they mean they're targeting that specific layer.

**Why does it matter?**
Different formations have different amounts of oil and gas, different porosity, different permeability (how easily fluids flow through them), and different depths. Choosing the right formation to target is one of the biggest decisions in an investment.

**How does SHALE YEAH handle it?**
The `geowiz` agent accepts a list of target formations in its input. It filters the LAS data to just those depth intervals and computes quality metrics for each one. The LLM prompt includes the formation name so Claude can incorporate geological knowledge about that formation into the recommendation.

---

### TOC (Total Organic Carbon)

**What is it?**
TOC is a percentage that measures how much organic material (dead plants and animals from millions of years ago) is in the rock. Organic material is what cooked into oil and gas over geological time. A TOC of 2% is decent. A TOC of 5–8% in a shale is very good.

**Why does it matter?**
Low TOC means the rock doesn't have much source material. Even if the porosity looks good, there might not be much oil or gas to find. TOC is one of the first things a geologist checks.

**How does SHALE YEAH handle it?**
`geowiz` estimates TOC based on the formation depth (deeper formations have typically had more time and heat to convert organics). Claude synthesizes this into the final TOC estimate. The fallback rule is: deeper than 10,000 ft → TOC 5.8%, 8,000–10,000 ft → 5.2%, etc.

---

### NPV (Net Present Value)

**What is it?**
NPV is the value of an investment in today's dollars, after accounting for the fact that money received in the future is worth less than money received now. A dollar today is worth more than a dollar next year because you could invest it and earn interest.

The calculation: take all future cash flows (revenue minus costs), discount each one back to today using a discount rate (typically 10% in oil and gas), and add them up. If NPV is positive, the investment makes money. If it's negative, you lose money.

**Why does it matter?**
NPV is the single most important number in investment analysis. It's the answer to "how much value does this investment actually create?" A project with a $5M NPV creates $5M of value on top of your required return.

**How does SHALE YEAH handle it?**
The `econobot` agent ([src/servers/econobot.ts](../src/servers/econobot.ts)) takes oil price, gas price, production forecasts, drilling cost, and operating cost as inputs and runs a discounted cash flow (DCF) model to compute NPV. The result feeds into Claude, which uses it to recommend PROCEED, CONDITIONAL, or DECLINE.

---

### IRR (Internal Rate of Return)

**What is it?**
IRR is the annual return rate that makes the NPV exactly zero. In plain English: if you invest $10M and the IRR is 25%, you're earning a 25% annual return on your money. A higher IRR is better. Most oil and gas investors want IRR above 15–20% to justify the risk.

**Why does it matter?**
IRR lets you compare investments with different sizes and timelines on an apples-to-apples basis. A $1M investment with 40% IRR might be better than a $10M investment with 18% IRR, depending on your available capital.

**How does SHALE YEAH handle it?**
`econobot` computes IRR iteratively (tries different discount rates until NPV = 0). It's included in the financial model JSON output and passed to Claude alongside NPV for the recommendation.

---

### Breakeven Price

**What is it?**
The breakeven oil (or gas) price is the minimum commodity price at which the investment stops losing money. If breakeven is $52/bbl and oil is trading at $70/bbl, you have $18/bbl of cushion. If oil drops to $45/bbl, you're underwater.

**Why does it matter?**
Oil prices are volatile. A project with a $35/bbl breakeven is much safer than one with a $65/bbl breakeven because it can survive a price crash. Investors often look for projects with at least $15–20/bbl of headroom below current prices.

**How does SHALE YEAH handle it?**
`econobot` computes both oil and gas breakeven prices as part of its financial model. They appear in the financial JSON output and are used by the `decision` agent when evaluating commodity price risk.

---

### Decline Curve / EUR (Estimated Ultimate Recovery)

**What is it?**
Oil and gas wells don't produce at a constant rate forever — they start high and decline over time. A "decline curve" is a mathematical model of that decline. The most common model is Arps hyperbolic: production drops fast at first, then levels off.

EUR is the total amount of oil or gas the well will ever produce, estimated by integrating the area under the decline curve from now until the well is abandoned.

**Why does it matter?**
EUR directly drives revenue. A well that produces 500,000 barrels over its life is worth roughly twice as much as one that produces 250,000 barrels (at the same oil price). EUR is the foundation of the economics.

**How does SHALE YEAH handle it?**
The `curve-smith` agent ([src/servers/curve-smith.ts](../src/servers/curve-smith.ts)) fits an Arps decline model to production history data and computes EUR. LLM integration is planned in issue [#213](https://github.com/ryemyster/ShaleYeah/issues/213) — currently uses Arps equations directly.

---

### WTI and Henry Hub

**What is it?**
WTI (West Texas Intermediate) is the benchmark price for crude oil in the US, measured in dollars per barrel ($/bbl). Henry Hub is the benchmark price for natural gas, measured in dollars per million BTU ($/MMBtu or $/MCF).

These prices change every day based on supply, demand, and global events.

**Why does it matter?**
Every economic calculation in oil and gas depends on commodity prices. A 10% drop in oil prices can turn a profitable investment into a money-loser.

**How does SHALE YEAH handle it?**
The `market` agent ([src/servers/market.ts](../src/servers/market.ts)) can pull live WTI and Henry Hub prices from the EIA (US Energy Information Administration) API if `EIA_API_KEY` is set. Without the key, it uses hardcoded price constants as a stand-in.

---

### Monte Carlo Simulation

**What is it?**
Monte Carlo is a way of measuring uncertainty by running the same calculation thousands of times with slightly different inputs each time. For example, you might run the NPV calculation 10,000 times — each time drawing a random oil price, a random production rate, and a random drilling cost from realistic ranges. The result is a distribution: "78% chance of positive NPV, median NPV of $3.2M."

**Why does it matter?**
A single NPV number hides uncertainty. Monte Carlo shows you the range of outcomes and how likely each one is. It's much more honest than saying "NPV is $3.2M" when it could realistically be anywhere from $1M to $6M depending on prices and geology.

**How does SHALE YEAH handle it?**
The `risk-analysis` agent ([src/servers/risk-analysis.ts](../src/servers/risk-analysis.ts)) runs the risk scoring and probability estimates. Full Monte Carlo with real distributions is planned as part of LLM integration in issue [#214](https://github.com/ryemyster/ShaleYeah/issues/214).

---

## Investing and Finance Terms

### Due Diligence

**What is it?**
Due diligence (often called "DD") is the process of thoroughly investigating an investment before committing money. It covers geology, engineering, economics, legal title, and market conditions. The goal is to find out everything that could go wrong before you sign a check.

**Why does it matter?**
Most investment losses in oil and gas come from things that weren't discovered during due diligence — a title defect, a bad geological interpretation, or costs that were underestimated. Good DD reduces surprises.

**How does SHALE YEAH handle it?**
The "full due diligence" bundle in the kernel runs all 14 agents in dependency-ordered phases. The kernel's `fullAnalysis()` method is literally the automation of the DD process. See [docs/ARCHITECTURE.md](ARCHITECTURE.md) for how the phases work.

---

### Go/No-Go Decision

**What is it?**
At the end of an investment analysis, someone has to decide: do we invest or not? This is the go/no-go decision. It's binary — you either commit capital or you don't. The decision is based on all the analysis: geology, economics, risk, legal, market.

**Why does it matter?**
All the analysis in the world is worthless if it doesn't lead to a clear, actionable decision. The go/no-go is the whole point of the process.

**How does SHALE YEAH handle it?**
The `decision` agent produces the go/no-go recommendation. It's set up with a "confirmation gate" — the kernel won't execute the final decision until a human explicitly confirms it with `kernel.confirmAction()`. This is intentional: an AI shouldn't commit capital without a human in the loop.

---

### Discount Rate

**What is it?**
The discount rate is the annual return you require on an investment before you'd consider it worthwhile. In oil and gas, a 10% discount rate (written as "10% PV" or "PV10") is standard. It means: future cash flows are discounted at 10% per year. A dollar received 10 years from now is worth about 39 cents today at 10% discount.

**Why does it matter?**
Using a higher discount rate makes NPV lower (it values future cash flows less). This is appropriate for riskier investments — you need higher returns to justify the risk.

**How does SHALE YEAH handle it?**
`econobot` defaults to a 10% discount rate (industry standard) but accepts a custom rate in its input. The rate is used in the DCF model to compute NPV and IRR.

---

## Technology Terms

### MCP (Model Context Protocol)

**What is it?**
MCP is an open standard created by Anthropic that defines how AI tools communicate with each other and with AI models like Claude. Think of it like USB — it's a common plug shape so that any tool can connect to any AI without custom wiring.

Each SHALE YEAH server is an MCP server. That means it can run standalone and be connected to any MCP-compatible AI client (like Claude Desktop), not just SHALE YEAH's own kernel.

**Why does it matter?**
Without a standard like MCP, every AI tool would need custom integration code to talk to every AI model. MCP means you write the tool once and it works everywhere.

**How does SHALE YEAH handle it?**
Every agent extends `MCPServer` ([src/shared/mcp-server.ts](../src/shared/mcp-server.ts)), which handles all the MCP protocol details. You register tools with `this.registerTool()` and the base class takes care of the rest.

---

### The Kernel

**What is it?**
The kernel is SHALE YEAH's internal traffic controller. When you call `npm run demo` or `npm run prod`, you're talking to the kernel. It:

- Knows about all 14 agents (the "registry")
- Decides which agents to run and in what order (the "executor")
- Runs independent agents in parallel to save time (scatter-gather)
- Tracks results across agents within a session (the "session manager")
- Enforces permissions (who can run which tools) and logs everything (the audit trail)

**Why does it matter?**
Without the kernel, you'd have to manually call each of the 14 agents in the right order, wait for each one, and pass results between them yourself. The kernel automates all of that. It's why "full due diligence" takes seconds instead of hours.

**How does SHALE YEAH handle it?**
The kernel lives in `src/kernel/`. The main entry point is `src/kernel/index.ts`. See [docs/ARCHITECTURE.md](ARCHITECTURE.md) for a full walkthrough.

---

### Fixture Data (Demo Mode)

**What is it?**
Fixture data is pre-written, realistic fake data used in tests and demo mode. Instead of calling the real Claude API, demo mode injects fixture inputs into each agent so they return consistent, deterministic outputs.

**Why does it matter?**
Tests need to be repeatable. If tests called the real Claude API, they'd be slow, expensive, and could fail based on what Claude happened to say that day. Fixture data lets you test the whole pipeline fast and free.

**How does SHALE YEAH handle it?**
Fixtures are injected via `src/mcp-client.ts`. Demo mode bypasses the LLM call entirely and returns the fixture output directly. See [docs/DEMO_VS_PRODUCTION.md](DEMO_VS_PRODUCTION.md).

---

### Resource Reference

**What is it?**
A resource reference is a short "ticket" that points to a large blob of data stored inside the kernel's session. Instead of copying a big formation log or cash-flow table through every tool call, a tool saves the blob once and hands back a small ticket (a `ResourceRef`). Downstream tools pass the ticket; the kernel automatically swaps it back for the full data before the tool ever sees it.

Think of it like a coat check at a restaurant. You hand in your heavy coat, get a numbered ticket, and later hand the ticket back to get your coat — instead of carrying the coat through every room.

**Why does it matter?**
In a chain of 14 agents, the same large dataset (like a full well log) would otherwise get copied through every tool call. That wastes memory and makes each call slower. Resource references cut the copy-and-paste by storing the data once and passing a short ID everywhere else.

**How does SHALE YEAH handle it?**

- `session.storeResource(id, data, mimeType)` — saves the blob and returns a `ResourceRef` ticket.
- `session.getResource(id)` — retrieves the blob by ID.
- The kernel's executor (`src/kernel/executor.ts`) automatically detects any `ResourceRef` values in a tool's input args and swaps them for the real payload before calling the tool — the tool author never has to think about it.
- Resource IDs follow the convention `"<server>:<data-type>:<run-id>"`, for example `"geowiz:formation-data:run-abc123"`.

See `src/kernel/types.ts` for the `ResourceRef` and `StoredResource` types.

---

### callLLM()

**What is it?**
`callLLM()` is the single function all agents use to talk to Claude. It's defined in `src/shared/llm-client.ts`. You pass it a prompt (the question or task) and optionally a system prompt (background instructions for Claude), and it returns Claude's response as a string.

**Why does it matter?**
Having one shared function means all agents talk to Claude the same way. If we need to change the model, add retry logic, or add logging, we change it in one place and all 14 agents get the update automatically.

**How does SHALE YEAH handle it?**
`callLLM()` requires `ANTHROPIC_API_KEY` to be set. If it's missing, it throws a clear error message. Each agent wraps `callLLM()` in a try/catch and falls back to rule-based estimates if the call fails. This means the system degrades gracefully — you still get an answer, just not an AI-generated one.

---

## How SHALE YEAH is better than doing this manually

Traditional oil and gas investment analysis looks like this:

| Step | Who does it | How long | What can go wrong |
| --- | --- | --- | --- |
| Geological review | Senior geologist | 2–6 weeks | Biased interpretation, missed data |
| Economic modeling | Financial analyst | 1–3 weeks | Wrong assumptions, spreadsheet errors |
| Engineering review | Reservoir engineer | 1–2 weeks | Optimistic EUR estimates |
| Risk assessment | Risk manager | 1 week | Ignored tail risks |
| Legal review | Lawyer | 1–2 weeks | Missed title defects |
| Report writing | Analyst team | 1 week | Inconsistent conclusions |
| **Total** | **5–7 people** | **8–20 weeks** | **High variance, high cost** |

SHALE YEAH's approach:

| Step | Who does it | How long | What's different |
| --- | --- | --- | --- |
| All 14 analyses | Kernel + Claude | Seconds to minutes | Consistent inputs, no ego, no fatigue |
| LLM synthesis | Claude | Part of above | Draws on training across thousands of wells |
| Report writing | `reporter` agent | Part of above | Same format every time, no typos |
| Human review | You | Minutes | You review the output, not produce it |

The human doesn't disappear — you review the output and make the final call (the kernel's confirmation gate enforces this). But instead of spending weeks producing the analysis, you spend minutes reviewing it.

The code also makes it auditable: every tool call is logged to `data/audit/YYYY-MM-DD.jsonl` with who called it, what they passed in, and what came back. That's something a manual process rarely provides.
