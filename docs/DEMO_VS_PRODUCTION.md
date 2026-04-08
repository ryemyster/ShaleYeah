# Demo vs Production Modes

SHALE YEAH has two ways to run. This page explains the difference so you know which one to use and what to expect.

---

## Demo Mode (`npm run demo`)

Demo mode runs without any API key. Instead of calling Claude, each server uses **fixture data** — pre-written inputs that produce realistic but deterministic outputs. The same inputs always produce the same outputs, which makes demo mode great for testing that the plumbing works without spending money on API calls.

**When to use it:**

- Verifying the system runs after a code change (the pre-commit gate runs `npm run demo`)
- Showing the system to someone without needing a live API key
- Developing and testing new code before wiring up the real LLM

**What it does NOT do:**

- Call the Anthropic API — no real AI analysis happens
- Read real LAS or Excel files — fixture data is used instead
- Produce different output if you change the input — it's deterministic by design

```bash
npm run demo
# Results appear in: outputs/demo/demo-YYYYMMDDTHHMMSS/
```

**Output files:**

| File | What It Contains |
| ---- | ---------------- |
| `INVESTMENT_DECISION.md` | Go/no-go recommendation with confidence scores |
| `DETAILED_ANALYSIS.md` | Findings from all 14 expert domains |
| `FINANCIAL_MODEL.json` | Financial model with NPV, IRR, and other metrics |

---

## Production Mode (`npm run prod`)

Production mode calls the real Claude API. Each server that has `callLLM` wired will generate a genuine AI response based on the actual data you provide. Servers that are not yet wired fall back to rule-based estimates (see LLM Integration Status below).

**Requirements:**

- `ANTHROPIC_API_KEY` set in your `.env` file — required for real AI output
- `EIA_API_KEY` set in your `.env` file — optional, enables live commodity prices in `market.ts`
- Real data files in `data/samples/` (see below)

```bash
# .env (never commit this file)
ANTHROPIC_API_KEY=sk-ant-...
EIA_API_KEY=your_eia_key_here   # optional
```

```bash
npm run prod
# Results appear in: outputs/reports/
```

**Required data files:**

| File | Format | Used By |
| ---- | ------ | ------- |
| `data/samples/demo.las` | LAS 2.0 well log | `geowiz`, `curve-smith` |
| `data/samples/economics.csv` | CSV with Parameter/Value/Unit columns | `econobot` |

---

## LLM Integration Status

This table shows which servers actually call Claude and which still use rule-based fallbacks. When a server has `callLLM` wired, it sends the real data to Claude and uses the AI-generated response. When it doesn't, it computes an estimate from the numbers directly.

| Server | Calls Claude? | What Claude Does |
| ------ | ------------- | ---------------- |
| `geowiz` | ✅ Yes | Synthesizes TOC estimate and geological recommendation from formation data |
| `econobot` | ✅ Yes | Generates PROCEED/CONDITIONAL/DECLINE recommendation from financial metrics |
| `curve-smith` | Planned (#213) | Decline curve regression and EUR synthesis |
| `risk-analysis` | Planned (#214) | Risk weight calibration and Monte Carlo narrative |
| `decision` | Planned (#215) | Final investment recommendation synthesis |
| `reporter` | Planned (#216) | Executive report narrative generation |
| `research`, `legal`, `market`, `title`, `development`, `drilling`, `infrastructure`, `test` | Planned (#217) | Domain-specific LLM synthesis |

**What "falls back" means:** If `ANTHROPIC_API_KEY` is absent or the API call fails, the server computes a rule-based estimate from the input data and returns that instead of crashing. The result is still a valid analysis — it just wasn't written by Claude.

---

## Side-by-Side Comparison

| | Demo Mode | Production Mode |
| --- | --------- | --------------- |
| **API key needed?** | No | Yes (for real AI output) |
| **Data source** | Fixture data (pre-written) | Your real LAS/CSV files |
| **LLM calls** | None | Yes (for wired servers) |
| **Output location** | `outputs/demo/` | `outputs/reports/` |
| **Speed** | ~0 seconds | Seconds to minutes |
| **API cost** | $0 | Small (Claude API usage) |
| **Good for** | Testing, CI, demos | Real investment analysis |

---

## Setting Up Production

```bash
# 1. Create .env with your API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env

# 2. Add your data files
cp your-well-logs.las data/samples/demo.las
cp your-economics.csv data/samples/economics.csv

# 3. Verify the files exist
ls data/samples/

# 4. Run production analysis
npm run prod
```

If you don't have real LAS or CSV files yet, see [docs/GETTING_STARTED.md](GETTING_STARTED.md) for example file formats.

---

Generated with SHALE YEAH 2025 Ryan McDonald - Apache-2.0
