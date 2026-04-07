# SHALE YEAH — Agent OS Architecture Review

*Last reviewed: 2026-03-30 | Closes #219*

This document is the acceptance criteria audit for issue #219: **is SHALE YEAH a true Agent OS, or a waterfall automation chain?**

The honest answer today: **it is waterfall with excellent scaffolding**. The infrastructure to become a true Agent OS exists — it just isn't wired up. This document records what is true now, what must change, and where each fix lives.

---

## The Test: Agent OS vs. Waterfall Automation

| Property | Agent OS | Waterfall Automation | SHALE YEAH Today |
|---|---|---|---|
| Tool selection | Dynamic — agents discover what to call | Static — sequence is hardcoded | ❌ Static bundles |
| Execution plan | Adapts based on input data and prior results | Fixed sequence runs regardless | ❌ Same bundle always runs |
| Inter-agent context | Prior results flow into downstream agent prompts | Each step receives only raw input args | ❌ No result forwarding |
| Decision synthesis | Reasoned argument weighing all inputs | Weighted average of confidence scores | ❌ Mock/placeholder |
| Failure response | Adapts plan when an agent fails or returns low confidence | Pipeline fails or skips | 🔶 Graceful skip, no adaptation |
| Self-awareness | Agents know what other agents concluded | Agents only see their own inputs | ❌ No cross-agent awareness |

---

## Finding 1: Execution Bundles Are Hardcoded Sequences

**File:** `src/kernel/executor.ts` — `FULL_DUE_DILIGENCE_BUNDLE`

The bundle defines a static 14-step waterfall. Every analysis run executes the same steps in the same order regardless of:
- What input files are present (no LAS file → geowiz still runs against nothing)
- What Phase 1 agents found (low geological confidence → no escalation)
- Whether the tract is worth deeper analysis (quick screen says no → full analysis runs anyway)

The dependency graph (`dependsOn`) is correct — it prevents Phase 2 from running before Phase 1. But dependencies enforce *ordering*, not *conditional execution*. There is no mechanism to say: "if geowiz returned confidence < 0.3, skip the financial analysis."

**What needs to change (tracked in #117):**
- `BundleStep` needs a `condition` field: a predicate evaluated against prior phase results
- `executeBundle()` needs to evaluate conditions before adding a step to the active phase
- Input-data-driven step skipping: if `tractArgs.lasFile` is absent, geowiz step is skipped with a `DATA_UNAVAILABLE` result, not a failure

**Example of what this should look like:**
```typescript
{
  toolName: "econobot.analyze",
  condition: (priorResults) => {
    const geo = priorResults.get("geowiz.analyze");
    return geo?.confidence !== undefined && geo.confidence >= 0.25;
  },
  dependsOn: ["geowiz.analyze"],
  parallel: true,
  optional: false
}
```

---

## Finding 2: Agent Results Do Not Flow Between Agents

**File:** `src/kernel/context.ts` — `storeResult()` / `getResult()`

The `Session` class has `storeResult()` and `getResult()` methods. The `InjectedContext` includes an `availableResults` list. This infrastructure is correct and ready.

**The gap:** `storeResult()` is never called anywhere outside of the context module itself. The executor runs `executeBundle()` and collects results in a local `Map<string, ToolResponse>` — but those results are never stored in the session. Downstream agents receive `tractArgs` (the original input) plus nothing from upstream agents.

This means when `decision.analyze` runs, it has no access to what `geowiz`, `econobot`, or `risk-analysis` found. It cannot synthesize — it can only produce a result from scratch. That is not an investment decision agent. That is a standalone calculator.

**What needs to change (tracked in #204):**
- In `executeBundle()`, after each phase completes, store each successful result in the session: `session.storeResult(toolName, response)`
- Pass `sessionId` into `executeBundle()` so the executor can reach the session
- When building `tractArgs` for each step, merge in `session.getInjectedContext()` so downstream tools receive `availableResults`
- Each server's tool handler (Milestone 1 work, #211–#217) must read `availableResults` and call `session.getResult()` to load upstream findings into its prompt

**The cascade this enables:**
```
geowiz returns: { porosity: 0.18, confidence: 0.72, flags: ["thin_pay"] }
  → stored in session as "geowiz.analyze"

econobot receives injectedContext.availableResults = ["geowiz.analyze"]
  → calls getResult("geowiz.analyze")
  → uses porosity=0.18 in its DCF model
  → returns: { npv: "$12M", irr: "18%", confidence: 0.65 }
  → stored in session as "econobot.analyze"

decision receives all prior results
  → synthesizes: "Geology is marginal (thin pay, 0.72 confidence).
     Economics are viable at current prices (IRR 18%, 0.65 confidence).
     Recommend: CONDITIONAL GO — contingent on [specific conditions]."
```

This is what "14 coordinated AI agents" means. Without this, it's 14 independent calculators.

---

## Finding 3: The Decision Server Is a Calculator, Not a Synthesizer

**File:** `src/servers/decision.ts` (demo mode)

In demo mode, the decision server returns a hardcoded mock recommendation. In production mode (when `ANTHROPIC_API_KEY` is set), it will call the Anthropic API — but because Finding 2 means no upstream results flow in, the decision agent's prompt has no geological findings, no financial model, no risk assessment to synthesize.

The decision server **must**:
1. Receive all prior agent outputs (fix Finding 2 first)
2. Receive all confidence scores from prior agents
3. Produce a reasoned argument, not a number — the prompt must instruct it to write out its reasoning: "I recommend X because [geologist found Y, economist found Z, risk analyst flagged W]"
4. Explicitly state what it could not determine and what would increase its confidence
5. Flag conflicts: "Geology is bullish (72% confidence) but economics are marginal (45% confidence) — I am weighting the economic concern more heavily because..."

**Tracked in #215.**

---

## Finding 4: No Dynamic Plan Modification

**File:** `src/kernel/executor.ts` — `executeBundle()`

The executor resolves phases once at the start (`resolvePhases()`) and runs them sequentially. There is no opportunity mid-execution to:
- Add a step ("geowiz flagged a potential fault — add a second geological pass with different parameters")
- Remove a step ("quick screen returned confidence < 0.2 on all core metrics — skip full due diligence, return HARD NO")
- Change the detail level of a remaining step ("Phase 1 was inconclusive — run Phase 2 at `full` instead of `standard`")

This is the difference between a script and an agent. Scripts execute a plan. Agents modify their plan.

**What needs to change (tracked in #117):**
- `executeBundle()` should re-evaluate the remaining steps after each phase using a `PlanAdaptor` callback
- A `PlanAdaptor` receives completed phase results and returns a modified step list for remaining phases
- The kernel's `fullAnalysis()` should pass a default `PlanAdaptor` that implements the O&G-specific adaptation rules (abort if geology fails, escalate detail if Phase 1 is ambiguous)

---

## Finding 5: `storeResult()` Is Called Zero Times Outside Tests

**Verification:**
```
grep -r "storeResult\|getResult" src/ --include="*.ts"
```

Results: only `src/kernel/context.ts` (definition) and test files. No production call site.

This is the single highest-leverage fix: wire result storage into `executeBundle()`. Everything else (Finding 2, 3, 4) depends on this foundation.

---

## Acceptance Criteria Status

| Criterion | Status | Fix |
|---|---|---|
| Architecture review doc exists | ✅ This document | — |
| At least one example of dynamic plan modification | ❌ Not yet | #117 — Tool Chain |
| Decision server uses reasoned chain, not average | ❌ Mock today | #215 — wire real LLM |
| `storeResult()` used by 3+ downstream agents | ❌ Never called | #204 — Resource Reference |
| Test verifying execution trace is not fixed | ❌ Not yet | Add in #218 — E2E validation |

---

## Recommended Fix Order

These are the minimal changes to cross the line from waterfall to agentic:

**Step 1 (prerequisite for all intelligence work):** Wire `storeResult()` into `executeBundle()`. Pass `sessionId` through the execution chain. This is a kernel change, not a server change. Estimated: small, self-contained. **Do this before starting #211.**

**Step 2 (Milestone 1):** When implementing each server's real LLM calls (#211–#217), each tool handler must: (a) read `availableResults` from injected context, (b) call `session.getResult()` to load upstream findings, (c) include those findings in its prompt.

**Step 3 (#215 — decision server):** The decision server prompt must be structured as a synthesis task, not an analysis task. It receives all prior outputs and writes a reasoned recommendation.

**Step 4 (#117 — conditional steps):** Add `condition` predicates to `BundleStep`. Implement evaluation in `executeBundle()`. Start with the two highest-value conditions: skip financial analysis if geology confidence < 0.25, and abort full due diligence if quick screen returns confidence < 0.2 on all required steps.

---

## What "True Agent OS" Looks Like When Done

```
User submits: LAS file + Excel model + title docs

Kernel creates session, infers available data types
  → "LAS present: run geowiz at full detail"
  → "Excel present: run econobot with financial model"
  → "No title docs: mark legal/title as optional, run at summary"

Phase 1 (parallel): geowiz + econobot + curve-smith + market + research
  → results stored in session

Phase 1 evaluation by PlanAdaptor:
  → geowiz: confidence 0.71, flags "thin pay zone"
  → econobot: confidence 0.63, NPV positive at base case
  → Decision: "Phase 1 is viable, proceed to Phase 2 with elevated detail"
  → risk-analysis gets detail: "full" instead of "standard"
  → Add step: geowiz.detail_zone(zone="thin_pay") — geowiz gets a follow-up call

Phase 2 (parallel, informed by Phase 1):
  → risk-analysis receives geowiz + econobot results in its prompt
  → legal/title run at summary (no docs provided)
  → drilling receives geowiz formation data

Phase 3: reporter synthesizes Phase 1+2 findings
Phase 4: decision receives ALL prior results, writes reasoned recommendation

Output: INVESTMENT_DECISION.md
  → "CONDITIONAL GO — thin pay zone is a concern (geowiz, 71% confidence)
     but economics support the investment at current gas prices (IRR 18%).
     Recommend proceeding subject to: [specific conditions from risk-analysis]"
```

That is the product. Everything above is the path to get there.

---

*"We have built an excellent kernel. Now we need to put the expert inside it — and make sure the experts actually talk to each other."*
