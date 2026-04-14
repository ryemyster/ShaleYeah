# SHALE YEAH vs. Claude Managed Agents

*A plain-language comparison: what Anthropic's Managed Agents platform provides, and how SHALE YEAH was already built to match or exceed it — plus where the two work together.*

Reference: [Anthropic Engineering — Managed Agents](https://www.anthropic.com/engineering/managed-agents)

---

## Start Here: The Simple Version

Imagine you want to know if an oil well is worth buying.

You hire a team of specialists: a **geologist** who reads rock data, a **financial analyst** who crunches the numbers, a **lawyer** who checks if you actually own the land, a **risk expert** who figures out what could go wrong, and 10 more. They all work together and give you one answer: buy it or don't.

Now imagine Anthropic just built a **really nice office building** those specialists could work in — great desks, automatic security badges, fast elevators, a shared computer system.

**SHALE YEAH is the team of specialists.** Their expertise, their domain knowledge, their understanding of oil wells — that lives in SHALE YEAH's code.

**Managed Agents is the office building.** Better infrastructure for running AI agents.

Here's the thing: a better office building doesn't replace what the specialists know. And the specialists get smarter with every deal they work.

---

## What Anthropic Built (Plain English)

Anthropic's Managed Agents ([engineering blog](https://www.anthropic.com/engineering/managed-agents)) splits an AI agent into three separate pieces so they can each be improved independently:

| Piece | What It Does | Simple Version |
|---|---|---|
| **Session** | A durable log of everything that happened — stored safely, survives if the computer restarts | The filing cabinet that never loses your work |
| **Harness** | The AI's reasoning loop — stateless and fast, ~60% faster startup | The brain — can be swapped out or scaled up without losing the files |
| **Sandbox** | Where code runs and tools get called — isolated so nothing leaks | The room where the work actually happens, locked from the outside |

The big idea: these three pieces are no longer stuck together. You can scale the brain independently from the room. Credentials (passwords, API keys) never touch the generated code — they stay in a vault.

---

## Feature-by-Feature: Managed Agents vs. SHALE YEAH

This table shows every capability Managed Agents provides and whether SHALE YEAH already has it, was already designed for it, or still needs it.

| Managed Agents Capability | SHALE YEAH Today | Status |
|---|---|---|
| **Durable session log** — remembers what happened even after a restart | `src/kernel/context.ts` — `SessionManager` with `FileSessionStorage` writes sessions to disk. Also injects O&G context (basin, operator, formation) into every run — Managed Agents doesn't do that. | ✅ Already built |
| **Stateless harness** — the reasoning brain is decoupled from the stored state | Kernel executor holds zero state in-process by design. Session data lives on disk, not in memory. | ✅ Already built — same principle |
| **Credential security** — API keys never exposed to generated code | `src/kernel/secrets.ts` — `SecretsStore` with async resolvers. `AuditMiddleware` logs the key *name* and *source*, never the value. | ✅ Already built — with an audit trail Managed Agents doesn't have |
| **MCP connectivity** — tools plug in via the MCP standard | All 14 servers use `registerTool()` and are fully MCP-compliant. They could plug into a Managed Agents fleet with zero code changes. | ✅ Already built |
| **Sandboxed execution** — agents run in isolation | Per-server isolation enforced by the kernel router. Circuit breaker automatically cuts off any failing server. | ✅ Already built — domain-tuned: knows which servers to trust |
| **Error recovery** — automatic retry and graceful fallback | Circuit breaker, exponential backoff, fallback tool routing, graceful degradation with a manifest of what failed and why. | ✅ Already built — more sophisticated than generic recovery |
| **Parallel execution** — multiple agents running at the same time | `executeParallel()` via `Promise.allSettled`. `FULL_DUE_DILIGENCE` runs 14 servers across 4 dependency-ordered phases at once. | ✅ Already built — plus O&G-specific phase ordering |
| **Context across steps** — agents can see what earlier steps produced | `session.getAvailableResults()` injects prior findings into each agent call. GeoWiz's geological findings flow into EconoBot's economics. | ✅ Already built — domain-aware, not generic |
| **Hosted fleet infrastructure** — Anthropic runs the servers for you | Self-hosted today | ❌ Not yet — see issue #285 |
| **Fleet dashboard** — visual status of all running agents | Not built | ❌ Not yet — could use Managed Agents for this |

**What this means:** 8 out of 10 Managed Agents capabilities are already in SHALE YEAH. The 2 gaps are infrastructure conveniences — not domain intelligence. Both could be offloaded to Managed Agents, which would make the codebase *simpler*, not weaker.

---

## What SHALE YEAH Has That Managed Agents Will Never Have

Managed Agents is a general-purpose platform. It has no idea what oil and gas is. These are the capabilities that only exist in SHALE YEAH:

| Capability | What It Means in Plain English |
|---|---|
| **14 O&G domain experts** | Each server knows its specific job deeply: GeoWiz knows Wolfcamp A is different from Bakken. EconoBot knows how to build a DCF model for an oil well. The Legal server knows Texas Railroad Commission rules vs. New Mexico OCD rules. |
| **The full due diligence pipeline** | Geology runs first. Those findings feed into economics. Economics feeds into risk. Risk feeds into the final investment decision. No generic platform knows the right order for an oil and gas deal. |
| **INVEST / PASS / CONDITIONAL verdict** | Takes real petrophysical data, financial models, regulatory checks, and market prices — and produces one decision a board can act on. |
| **Formation-specific fallback logic** | When the AI is unavailable (no API key, demo mode), Wolfcamp A gets different default parameters than Bakken or Eagle Ford. That's domain knowledge in code — not a generic placeholder. |
| **Wiki memory that compounds** (planned — #284) | After every analysis run, the kernel compiles findings into structured notes per basin, per operator, per formation. Run 50 starts with what runs 1–49 already learned about this basin. Generic platforms start from scratch every time. |
| **Per-agent learning** (planned — #271) | GeoWiz after 50 Permian Basin analyses is not the same as a fresh GeoWiz. It's learned the GR cutoffs that actually work in that basin. |
| **Best-of-N sampling for high-stakes outputs** (planned — #270) | For the most important numbers (EUR, IRR, INVEST verdict), run the analysis N times and pick the best answer using domain-specific scoring — not just "ask the AI once and hope." |
| **Analyst feedback loop** (planned — #144) | When an analyst says "your EUR estimate was 20% too high — here's what the wells actually produced," that correction gets stored and used to improve future runs. That dataset belongs to you. Nobody else has it. |

---

## Why SHALE YEAH Was Already Built This Way

This isn't a response to Managed Agents — these architectural decisions were made before Managed Agents existed. Here's why they line up:

**Stateless execution + durable state** — the kernel never held session state in memory from day one. `FileSessionStorage` was built as a pluggable interface. Swapping in a Managed Agents session store means implementing one interface, not redesigning the system.

**MCP-first design** — every server uses the MCP standard. The kernel routes through MCP. This means the 14 servers could run as a Managed Agents fleet with zero changes to the servers — only the deployment target changes.

**Pluggable secrets** — `SecretsStore` accepts static strings or async resolver functions (e.g., fetch from a vault). Wiring in a Managed Agents credential vault is one resolver function.

**Domain intelligence is separate from infrastructure** — every design decision kept O&G knowledge in the server layer and plumbing in the kernel layer. The domain intelligence doesn't change when the infrastructure does.

The right way to think about this: the **domain intelligence is the invariant**. Infrastructure is the variable. Managed Agents is a very good variable.

---

## How the Two Work Together

The right question isn't "Managed Agents or SHALE YEAH" — it's "what if SHALE YEAH's 14 servers ran on a Managed Agents fleet?"

| Layer | Who Owns It |
|---|---|
| Hosted infrastructure, scaling, fleet dashboard | Managed Agents (if we deploy there — issue #285) |
| Session persistence at scale | Managed Agents session store (replaces `FileSessionStorage` for cloud) |
| Credential vault | Managed Agents (replaces `SecretsStore` in cloud deployment) |
| 14 O&G domain experts — their prompts, knowledge, fallback logic | SHALE YEAH — always |
| The full due diligence pipeline — phase ordering, verdict synthesis | SHALE YEAH — always |
| Memory that compounds — basin wiki, per-agent learning, feedback calibration | SHALE YEAH — always |

When Anthropic improves the office building, the specialists inside get better tools for free. The expertise in their heads stays exactly where it was — and keeps getting sharper.

---

## The Roadmap That Makes This Harder to Replicate Over Time

Each of these issues, when shipped, builds domain knowledge that a platform can't provide:

| Issue | What Ships | Why a Platform Can't Replace It |
|---|---|---|
| #284 — Wiki memory | Per-basin/operator/formation notes compiled after every run | Your 50 Permian analyses are not someone else's. That history is yours. |
| #271 — Per-agent learning | Each of 14 agents builds a private professional memory | A GeoWiz calibrated to your basin on your data is not a generic GeoWiz. |
| #270 — Best-of-N loops | EUR, IRR, INVEST verdict quality via repeated sampling | Scored against real production data — domain-specific, not generic. |
| #144 — Feedback calibration | Analyst corrections improve future runs; confidence tracks reality | A proprietary dataset of corrections that no platform can replicate. |
| #145 — Conditional workflows | Analysis escalates based on what it finds | The pipeline reasons about the deal. A building can't do that. |
| #285 — Managed Agents evaluation | Determine what infrastructure to offload | Simpler infrastructure, same domain intelligence. |

---

*Last updated: 2026-04-13 | [Open issues and roadmap](https://github.com/ryemyster/ShaleYeah/issues)*
