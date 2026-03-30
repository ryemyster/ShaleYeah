# SHALE YEAH — Project Intent Review

*Last reviewed: 2026-03-30*

This document exists to prevent drift. As the codebase grows, it's easy to lose sight of what we're actually building and why. Read this before starting any significant new feature.

---

## The Original Problem

Oil and gas investment decisions are slow, expensive, and inconsistent.

A single tract evaluation requires:
- A geologist (6+ weeks, $200K+/year salary) to analyze formation data
- A drilling engineer (4+ weeks) to assess technical feasibility
- A financial analyst (3+ weeks) to model economics
- A lawyer (2+ weeks) to review title and regulatory risk
- A market analyst to assess commodity price outlook
- A development engineer to plan production infrastructure

**Total: 15+ weeks. $500K+ in labor. And the quality varies by who you hired.**

For small operators, independent E&P companies, and mineral rights buyers — this cost and timeline is prohibitive. Many good deals go unevaluated because the analysis is too expensive to justify on smaller plays.

---

## What SHALE YEAH Is

SHALE YEAH replaces that team of specialists with 14 coordinated AI agents — each with deep domain expertise — running in parallel, producing investment-grade analysis in minutes.

**The core promise:**
> Give SHALE YEAH your well logs, financial models, and land data. Get back a professional investment recommendation — with confidence scores, risk breakdown, and executive-ready reports — in under 10 minutes.

It is **not** a chatbot. It is **not** a generic AI assistant. It is a **purpose-built investment analysis pipeline** for oil and gas.

---

## The Three Users We're Building For

### 1. The Investor / Decision-Maker
*"I need a go/no-go recommendation I can take to a board meeting."*

They don't care about MCP or TypeScript. They care about:
- Is this a good deal?
- What's the NPV and IRR?
- What are the risks?
- Can I trust this analysis?

**What they need from SHALE YEAH:** A clear, professional `INVESTMENT_DECISION.md` they can hand to their investment committee. Confidence scores they can calibrate against.

### 2. The O&G Professional (non-developer)
*"I have LAS files and an Excel model. I want to run this thing."*

They understand oil and gas. They do not understand TypeScript, MCP servers, or kernels. They care about:
- Does it understand my data?
- Is the geological analysis credible?
- Can I run it on my laptop without a PhD in software?

**What they need from SHALE YEAH:** Simple setup, clear file format instructions, and output they can audit against their own domain knowledge.

### 3. The Developer / Integrator
*"I want to connect SHALE YEAH to my existing data pipeline."*

They care about:
- Can I run individual servers standalone?
- Is the MCP interface standards-compliant?
- Can I extend it with custom servers?
- How do I connect this to Claude Desktop?

**What they need from SHALE YEAH:** Clean MCP interfaces, good API docs, a kernel they can compose programmatically.

---

## What We Have Built (Honest Assessment)

### The Good

**The kernel architecture is solid.** The Agent OS kernel — registry, executor, session manager, middleware pipeline — is a real, production-quality implementation. The circuit breaker, retry/backoff, RBAC, audit trail, and scatter-gather execution are not toys. They are well-designed.

**The MCP server pattern is clean.** 14 servers, all inheriting from `MCPServer`, all with typed schemas, all registerable as standalone tools or composable through the kernel. This is extensible and maintainable.

**The demo works.** `npm run demo` runs in ~6 seconds with no API keys and produces real-looking output. That's a genuine proof of concept.

**The Arcade.dev pattern coverage is honest progress.** 56% of 52 patterns implemented is real work — not checkbox theater. The implemented patterns (scatter-gather, confirmation gate, circuit breaker, audit trail, progressive detail) are the right ones to do first.

### The Gap

**The AI analysis is simulated.** In demo mode, the 14 "expert agents" return mock data. They are not actually calling an LLM and doing real geological analysis. The server infrastructure is real; the intelligence is placeholder.

This is the most important gap to be honest about. SHALE YEAH is currently:
- ✅ A production-quality **orchestration platform** for AI agents
- 🔶 A partially-real **analysis pipeline** (infrastructure yes, intelligence pending)
- ❌ Not yet a **true AI investment advisor** (the domain intelligence needs to be wired to real LLM calls)

In production mode with `ANTHROPIC_API_KEY`, the LLM calls happen — but the prompt engineering for each of the 14 domains is minimal. The geologist persona asks the right questions but doesn't yet have the depth of a real geologic analysis workflow.

---

## Where We Drifted

Looking at the open issues and recent work, we have been building:
- CI/CD hardening (supply chain security)
- Dependency upgrades (TypeScript 6, MCP SDK 1.28)
- Kernel infrastructure (circuit breaker, retry, auth, audit)
- More Arcade.dev patterns (issues #194–#210)

This is all **correct and necessary** — but it is **infrastructure**, not **intelligence**.

The risk: we build an excellent empty container and never fill it with real domain expertise.

---

## What "Done" Actually Looks Like

SHALE YEAH is done when a real O&G professional can:

1. Drop their LAS file, Excel model, and title documents into a folder
2. Run `npm run prod`
3. Get back an `INVESTMENT_DECISION.md` that a geologist would recognize as credible
4. Trust the confidence scores because they're calibrated against real outcomes

**The milestone order should be:**

### Milestone 1: Real Intelligence (Current Gap)
- Each server's tool handlers call the Anthropic API with domain-specific prompts
- Geowiz actually interprets LAS curve data (not mock values)
- Econobot actually builds a DCF model from the well data
- Decision server weighs all inputs and produces a reasoned recommendation
- Production mode end-to-end demo with a real LAS file

### Milestone 2: User Experience
- Simple installer / setup wizard for non-developers
- `docs/FOR-USERS.md` — plain-language guide
- `docs/HOW-TO-READ-RESULTS.md` — what the outputs mean
- Glossary of all O&G terms used

### Milestone 3: Production Hardening (in progress)
- Session persistence, caching, health checks, timeouts
- Per-phase model routing (#193) — cost control
- Schema explorer, natural identifiers — agent ergonomics

### Milestone 4: Platform
- REST API, streaming, webhooks
- External data connectors (BYODC)
- Multi-tenant, versioning, plugin system

---

## The North Star

Every feature decision should be tested against this question:

> **Does this help a small O&G investor evaluate a deal faster and more confidently than they could without it?**

If the answer is yes — build it.
If the answer is "it makes the architecture more elegant" — park it until Milestone 1 is done.

---

## Immediate Action Items

Based on this review, the highest priority work is:

1. **Wire real LLM calls into the 14 server tool handlers** — this is the core product, everything else is scaffolding
2. **Test with a real LAS file** — does geowiz produce credible geological output?
3. **Calibrate confidence scores** — are the numbers meaningful or arbitrary?
4. **Write `docs/FOR-USERS.md`** — can an O&G professional actually use this?

The Arcade patterns, CI hardening, and kernel infrastructure are all important — but they are the *container*. The *contents* (real domain intelligence) are what makes SHALE YEAH valuable.

---

*"We have built an excellent kernel. Now we need to put the expert inside it."*
