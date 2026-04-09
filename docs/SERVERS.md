# The 14 Expert Agents

SHALE YEAH has 14 AI agents, each one a specialist in a different part of oil and gas investment analysis. This page explains what each one does, where its code lives, and what it needs to run.

Every agent is built the same way:

- It lives in `src/servers/<name>.ts`
- It inherits from `MCPServer` (the base class in `src/shared/mcp-server.ts`), which handles the boring setup like registering tools and managing data directories
- It calls `callLLM()` (from `src/shared/llm-client.ts`) to send data to Claude and get back an AI-generated analysis — or falls back to a rule-based estimate if no API key is set
- It has a Roman Imperial persona — a name, title, and area of expertise that shows up in its output

---

## Core Analysis Agents

These four agents do the most important work and run first (Phase 1 of a full analysis).

### geowiz — Geological Analysis

**Persona:** Marcus Aurelius Geologicus, Master Geological Analyst

**What it does:** Reads LAS well log files (the standard format for underground rock measurements) and figures out:

- Which rock formations are worth targeting
- How porous the rock is (porous = can hold oil/gas)
- How deep the target zones are
- A TOC (Total Organic Carbon) estimate — higher TOC means more organic material that cooked into hydrocarbons

**LLM status:** ✅ Calls Claude. The LLM synthesizes the TOC estimate and writes a plain-English recommendation based on the formation data. Falls back to depth-based rules if no API key.

**Code:** [src/servers/geowiz.ts](../src/servers/geowiz.ts)

**Tests:** [tests/geowiz-anti-stub.test.ts](../tests/geowiz-anti-stub.test.ts)

---

### econobot — Economic Analysis

**Persona:** Caesar Augustus Economicus, Master Financial Strategist

**What it does:** Takes financial inputs (oil price, gas price, drilling cost, operating cost, discount rate) and computes:

- NPV (Net Present Value) — what the investment is worth in today's dollars
- IRR (Internal Rate of Return) — the annual return rate
- Payback period — how many months until you break even
- Breakeven oil and gas prices — the minimum price needed to make money

**LLM status:** ✅ Calls Claude. The LLM reads the financial metrics and returns PROCEED, CONDITIONAL, or DECLINE with a rationale. Falls back to rule-based thresholds if no API key.

**Code:** [src/servers/econobot.ts](../src/servers/econobot.ts)

**Tests:** [tests/econobot-anti-stub.test.ts](../tests/econobot-anti-stub.test.ts)

---

### curve-smith — Reservoir Engineering

**Persona:** Lucius Technicus Engineer, Master Reservoir Engineer

**What it does:** Models how a well's production will decline over time (called a "decline curve"). From that it estimates:

- EUR (Estimated Ultimate Recovery) — total oil/gas the well will ever produce
- Production forecasts by month/year
- Whether Arps hyperbolic, exponential, or harmonic decline fits the data best

**LLM status:** ✅ Wired (issue [#213](https://github.com/ryemyster/ShaleYeah/issues/213)). After fitting Arps decline parameters (qi, Di, b) from production data, `synthesizeInterpretationWithLLM()` sends those parameters to Claude. Claude returns a plain-English description of the decline character (e.g. "hyperbolic with strong early transient flow"), the nearest basin analog, and any anomaly flags. Falls back to `deriveDefaultInterpretation()` when the API is unavailable — no crash, just rule-based defaults.

**Code:** [src/servers/curve-smith.ts](../src/servers/curve-smith.ts)

---

### risk-analysis — Risk Assessment

**Persona:** Gaius Probabilis Assessor, Master Risk Strategist

**What it does:** Scores and ranks the risks in an investment:

- Geological risk (how confident are we about the rock?)
- Price risk (what if oil drops?)
- Operational risk (drilling problems, cost overruns)
- Combines these into an overall risk score and a probability-of-success estimate

**LLM status:** ✅ Wired (issue [#214](https://github.com/ryemyster/ShaleYeah/issues/214)). After computing input-derived risk scores for all six categories (geological, technical, economic, regulatory, environmental, operational), `synthesizeRiskInterpretationWithLLM()` sends the full risk profile to Claude. Claude returns a plain-English `{ topRisk, mitigationPriority, riskNarrative }` interpretation. Falls back to `deriveDefaultRiskInterpretation()` when the API is unavailable — no crash, just rule-based defaults.

**Code:** [src/servers/risk-analysis.ts](../src/servers/risk-analysis.ts)

---

## Decision and Reporting Agents

These run after the core analysis is complete and synthesize everything into a final answer.

### decision — Investment Decision

**Persona:** Augustus Decidius Maximus, Supreme Investment Strategist

**What it does:** Takes the outputs from all other agents and makes the final call: invest, don't invest, or invest with conditions. This is the agent that produces the go/no-go recommendation that ends up in `INVESTMENT_DECISION.md`.

**Important:** The decision tool requires human confirmation before it finalizes — the kernel won't execute it until you call `confirmAction()`. This prevents accidentally committing to a decision without reviewing it.

**LLM status:** ✅ Wired (issue [#215](https://github.com/ryemyster/ShaleYeah/issues/215)). After the rule-based scoring computes a preliminary INVEST/PASS/CONDITIONAL verdict, `synthesizeDecisionWithLLM()` sends all upstream numbers (NPV, IRR, payback, risk score, geological confidence, oil/gas price) to Claude. Claude returns a structured `{ verdict, biggestRisk, biggestUpside, rationale }` — and can upgrade or downgrade the preliminary call if the full picture warrants it. Confidence score scales with input completeness: 50% base + 10% per upstream domain present. Falls back to `deriveDefaultDecisionInterpretation()` when the API is unavailable — no crash, just rule-based defaults.

**Code:** [src/servers/decision.ts](../src/servers/decision.ts)

**Tests:** [tests/decision-anti-stub.test.ts](../tests/decision-anti-stub.test.ts)

---

### reporter — Executive Reporting

**Persona:** Scriptor Reporticus Maximus, Master Report Generator

**What it does:** Writes the final investment reports in plain English. Takes raw analysis data from all other agents and formats it into:

- `INVESTMENT_DECISION.md` — the one-page executive summary
- `DETAILED_ANALYSIS.md` — the full technical breakdown
- `FINANCIAL_MODEL.json` — structured data for financial analysts

**LLM status:** ✅ Wired (issue [#216](https://github.com/ryemyster/ShaleYeah/issues/216)) — `synthesizeReportWithLLM()` sends the full investment verdict (NPV, IRR, payback, confidence, risk factors, next steps, key findings) to Claude and gets back a professional analyst narrative under 500 words. Falls back to `deriveDefaultExecutiveSummary()` — a rule-based summary that still includes the real numbers — when the API is unavailable. Tested in [tests/reporter-anti-stub.test.ts](../tests/reporter-anti-stub.test.ts).

**Code:** [src/servers/reporter.ts](../src/servers/reporter.ts)

---

## Support Agents

These eight agents run in Phase 2 and provide specialized analysis that feeds into the decision.

### research — Market Intelligence

**Persona:** Scientius Researchicus, Master Intelligence Gatherer

**What it does:** Gathers information about comparable wells, competitors, and technology trends in the target area.

**Code:** [src/servers/research.ts](../src/servers/research.ts)

---

### legal — Legal and Regulatory

**Persona:** Legatus Juridicus, Master Legal Strategist

**What it does:** Reviews contract terms, regulatory requirements, and legal risks associated with the investment.

**Code:** [src/servers/legal.ts](../src/servers/legal.ts)

---

### market — Commodity Markets

**Persona:** Mercatus Analyticus, Master Market Strategist

**What it does:** Analyzes current and forecast commodity prices (oil and gas). Can pull live WTI and Henry Hub prices if `EIA_API_KEY` is set. Falls back to hardcoded price constants without it.

**Code:** [src/servers/market.ts](../src/servers/market.ts)

---

### title — Title and Ownership

**Persona:** Titulus Verificatus, Master Title Analyst

**What it does:** Verifies that the mineral rights ownership is clean — no disputes, liens, or gaps in the chain of title that could block the investment.

**Code:** [src/servers/title.ts](../src/servers/title.ts)

---

### development — Development Planning

**Persona:** Architectus Developmentus, Master Development Coordinator

**What it does:** Plans how the development program would be structured — well count, spacing, timing, capital allocation.

**Code:** [src/servers/development.ts](../src/servers/development.ts)

---

### drilling — Drilling Operations

**Persona:** Perforator Maximus, Master Drilling Strategist

**What it does:** Analyzes the drilling program: well design, depth, completion strategy, and cost optimization.

**Code:** [src/servers/drilling.ts](../src/servers/drilling.ts)

---

### infrastructure — Surface Infrastructure

**Persona:** Structura Ingenious, Master Infrastructure Architect

**What it does:** Evaluates what surface facilities are needed — pipelines, separators, storage — and estimates their cost.

**Code:** [src/servers/infrastructure.ts](../src/servers/infrastructure.ts)

---

### test — Quality Assurance

**Persona:** Testius Validatus, Master Quality Controller

**What it does:** Runs a final validation pass over all analysis outputs. Flags anything that looks inconsistent, missing, or below confidence thresholds before the reporter generates the final report.

**Code:** [src/servers/test.ts](../src/servers/test.ts)

---

## LLM Integration Status Summary

| Agent | Calls Claude? | Issue |
| --- | --- | --- |
| `geowiz` | ✅ Yes | — |
| `econobot` | ✅ Yes | — |
| `curve-smith` | ✅ Yes | — |
| `risk-analysis` | ✅ Yes | — |
| `decision` | ✅ Yes | — |
| `reporter` | ✅ Yes | — |
| All 8 support agents | Planned | [#217](https://github.com/ryemyster/ShaleYeah/issues/217) |

When an agent doesn't yet call Claude, it computes a reasonable estimate from the input data using rules (like "if NPV > $1M, recommend PROCEED"). The estimate is still useful — it just wasn't generated by an AI. See [docs/DEMO_VS_PRODUCTION.md](DEMO_VS_PRODUCTION.md) for more detail.

---

## How to add a new agent

If you need to add a 15th agent:

1. Copy an existing server file, e.g.: `cp src/servers/research.ts src/servers/myagent.ts`
1. Change the class name, persona, and tool registration in the new file
1. Add it to `src/mcp-client.ts` (the `serverConfigs` array) so the kernel knows it exists
1. Add `npm run server:myagent` to `package.json` scripts
1. Write a test in `tests/myagent-anti-stub.test.ts` following the pattern in `tests/geowiz-anti-stub.test.ts`
1. Update this file (`docs/SERVERS.md`) with the new agent's entry

---

*Generated with SHALE YEAH 2025 Ryan McDonald - Apache-2.0*
