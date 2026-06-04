# Glossary — Oil & Gas, Investing, and How SHALE YEAH Handles It

If you're new to oil and gas or investment analysis, this page explains the terms you'll see in the code and reports. Each entry answers three questions:

1. **What is it?** — a plain-English explanation
1. **Why does it matter?** — what goes wrong if you ignore it
1. **How does SHALE YEAH handle it?** — which agent deals with it

---

## Oil & Gas Terms

### LAS File (Log ASCII Standard)

**What is it?**
A LAS file is a text file that contains measurements taken inside a well as a drill bit or sensor is lowered down the borehole. Think of it as an X-ray of the underground rock. A typical LAS file has columns for depth (in feet) and measurements like gamma ray (tells you if it's shale or sand), porosity (how much empty space is in the rock), and bulk density.

**Why does it matter?**
Without well log data, you're guessing what's underground. The LAS file is the primary evidence for how good the rock is. A well with high porosity in the target zone is much more likely to produce oil or gas than one with low porosity.

**How does SHALE YEAH handle it?**
The `geowiz` server (`servers/geowiz/`) reads LAS files. It extracts depth, porosity, and density measurements, computes averages across the target zone, and feeds those numbers to Claude for a geological recommendation.

---

### Formation / Zone / Interval

**What is it?**
Underground rock is layered like a cake. Each distinct layer is called a "formation." Geologists give formations names — "Wolfcamp A," "Wolfcamp B," "Austin Chalk," "Bone Spring" — based on where they were first described or what they're made of. When someone says they're drilling to "the Wolfcamp," they mean they're targeting that specific layer.

**Why does it matter?**
Different formations have different amounts of oil and gas, different porosity, different permeability (how easily fluids flow through them), and different depths. Choosing the right formation to target is one of the biggest decisions in an investment.

**How does SHALE YEAH handle it?**
The `geowiz` server accepts a list of target formations. It filters the LAS data to just those depth intervals and computes quality metrics for each one. The LLM prompt includes the formation name so Claude can incorporate geological knowledge about that formation.

---

### TOC (Total Organic Carbon)

**What is it?**
TOC is a percentage that measures how much organic material (dead plants and animals from millions of years ago) is in the rock. Organic material is what cooked into oil and gas over geological time. A TOC of 2% is decent. A TOC of 5–8% in a shale is very good.

**Why does it matter?**
Low TOC means the rock doesn't have much source material. Even if the porosity looks good, there might not be much oil or gas to find. TOC is one of the first things a geologist checks.

**How does SHALE YEAH handle it?**
`geowiz` estimates TOC based on formation depth (deeper formations have had more time and heat to convert organics). The fallback rule: deeper than 10,000 ft → TOC 5.8%, 8,000–10,000 ft → 5.2%, etc. Claude synthesizes this into the final TOC estimate.

---

### NPV (Net Present Value)

**What is it?**
NPV is the value of an investment in today's dollars, after accounting for the fact that money received in the future is worth less than money received now. A dollar today is worth more than a dollar next year because you could invest it and earn interest.

The calculation: take all future cash flows (revenue minus costs), discount each one back to today using a discount rate (typically 10% in oil and gas), and add them up. If NPV is positive, the investment makes money. If it's negative, you lose money.

**Why does it matter?**
NPV is the single most important number in investment analysis. It answers "how much value does this investment actually create?"

**How does SHALE YEAH handle it?**
The `econobot` server takes oil price, gas price, production forecasts, drilling cost, and operating cost and runs a discounted cash flow (DCF) model to compute NPV. The result feeds into Claude, which recommends PROCEED, CONDITIONAL, or DECLINE.

---

### IRR (Internal Rate of Return)

**What is it?**
IRR is the annual return rate that makes the NPV exactly zero. If you invest $10M and the IRR is 25%, you're earning a 25% annual return. Most oil and gas investors want IRR above 15–20% to justify the risk.

**Why does it matter?**
IRR lets you compare investments with different sizes and timelines on an apples-to-apples basis.

**How does SHALE YEAH handle it?**
`econobot` computes IRR iteratively. It's included in the financial model output alongside NPV.

---

### Breakeven Price

**What is it?**
The breakeven oil (or gas) price is the minimum commodity price at which the investment stops losing money. If breakeven is $52/bbl and oil is trading at $70/bbl, you have $18/bbl of cushion.

**Why does it matter?**
Oil prices are volatile. A project with a $35/bbl breakeven is much safer than one with a $65/bbl breakeven. Investors look for at least $15–20/bbl of headroom below current prices.

**How does SHALE YEAH handle it?**
`econobot` computes both oil and gas breakeven prices as part of its financial model.

---

### Decline Curve / EUR (Estimated Ultimate Recovery)

**What is it?**
Oil and gas wells don't produce at a constant rate — they start high and decline over time. A "decline curve" is a mathematical model of that decline. EUR is the total amount of oil or gas a well will ever produce, estimated by integrating the area under the decline curve.

**Why does it matter?**
EUR directly drives revenue. A well that produces 500,000 barrels over its life is worth roughly twice as much as one that produces 250,000 barrels at the same price.

**How does SHALE YEAH handle it?**
The `curve-smith` server fits an Arps hyperbolic decline model to production history and computes EUR.

---

### WTI and Henry Hub

**What is it?**
WTI (West Texas Intermediate) is the benchmark price for US crude oil in $/bbl. Henry Hub is the benchmark for natural gas in $/MMBtu. Both change daily.

**Why does it matter?**
Every economic calculation in oil and gas depends on commodity prices. A 10% drop in oil prices can turn a profitable investment into a loss.

**How does SHALE YEAH handle it?**
The `market` server pulls live WTI and Henry Hub prices from the EIA API if `EIA_API_KEY` is set. Without the key, it uses fallback price constants. See `servers/market/docs/EIA_API_SETUP.md`.

---

### Monte Carlo Simulation

**What is it?**
Monte Carlo runs the same calculation thousands of times with slightly different inputs drawn from realistic ranges. The result is a distribution: "78% chance of positive NPV, median NPV of $3.2M."

**Why does it matter?**
A single NPV number hides uncertainty. Monte Carlo shows the range of outcomes and how likely each is.

**How does SHALE YEAH handle it?**
The `risk-analysis` server runs risk scoring and Monte Carlo probability estimates.

---

## Investing and Finance Terms

### Due Diligence

**What is it?**
Due diligence (DD) is the process of thoroughly investigating an investment before committing money. It covers geology, engineering, economics, legal title, and market conditions.

**Why does it matter?**
Most investment losses come from things not discovered during DD — a title defect, a bad geological interpretation, underestimated costs.

**How does SHALE YEAH handle it?**
Each of the 14 specialist servers covers one domain. The `decision` server synthesizes their outputs into a final go/no-go recommendation. See [ARCHITECTURE.md](ARCHITECTURE.md).

---

### Go/No-Go Decision

**What is it?**
At the end of investment analysis, someone decides: invest or not. This is the go/no-go — binary, based on all the analysis.

**Why does it matter?**
All the analysis is worthless if it doesn't lead to a clear, actionable decision.

**How does SHALE YEAH handle it?**
The `decision` server produces the go/no-go recommendation. HITL (human-in-the-loop) policy on the `geologist` agent enforces human review before capital commitment.

---

### Discount Rate

**What is it?**
The annual return required before an investment is worthwhile. In oil and gas, 10% (PV10) is standard. A dollar received in 10 years is worth about 39 cents today at 10%.

**How does SHALE YEAH handle it?**
`econobot` defaults to 10% but accepts a custom rate.

---

## Technology Terms

### MCP (Model Context Protocol)

**What is it?**
MCP is an open standard from Anthropic defining how AI tools communicate with AI models. Like USB — a common connector so any tool works with any MCP-compatible AI.

**Why does it matter?**
Without MCP, every tool needs custom integration code for every AI model. MCP means write once, works everywhere.

**How does SHALE YEAH handle it?**
Every server extends `MCPServer` from `@shaleyeah/sdk`, which handles the MCP protocol. Tools are registered with `this.registerTool()`.

---

### callLLM()

**What is it?**
`callLLM()` is the single function all servers use to talk to Claude. It's exported from `@shaleyeah/sdk`. You pass a prompt and get Claude's response as a string.

**Why does it matter?**
One shared function means all servers talk to Claude the same way. Model changes, retry logic, and logging happen in one place.

**How does SHALE YEAH handle it?**
`callLLM()` requires `ANTHROPIC_API_KEY`. If it's missing, it throws a clear error. Each server wraps it in try/catch and falls back to rule-based estimates if the call fails — the system always returns an answer.

---

## How SHALE YEAH compares to manual analysis

**Traditional process:**

| Step | Who | Time | Risk |
|------|-----|------|------|
| Geological review | Senior geologist | 2–6 weeks | Biased interpretation |
| Economic modeling | Financial analyst | 1–3 weeks | Spreadsheet errors |
| Engineering review | Reservoir engineer | 1–2 weeks | Optimistic EUR |
| Risk assessment | Risk manager | 1 week | Ignored tail risks |
| Legal review | Lawyer | 1–2 weeks | Missed title defects |
| Report writing | Analyst team | 1 week | Inconsistent conclusions |
| **Total** | **5–7 people** | **8–20 weeks** | **High variance, high cost** |

**SHALE YEAH:**

| Step | Who | Time | What's different |
|------|-----|------|-----------------|
| All 14 analyses | 14 AI servers | Seconds to minutes | Consistent, no fatigue |
| LLM synthesis | Claude | Part of above | Trained on thousands of wells |
| Report writing | `reporter` server | Part of above | Same format every time |
| Human review | You | Minutes | You review, not produce |

The human doesn't disappear — you review the output and make the final call. HITL policies enforce this at the agent layer.
