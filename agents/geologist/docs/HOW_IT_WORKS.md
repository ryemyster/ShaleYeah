# How the Geologist Agent Works

## The simple version

Imagine you have a super-smart geologist friend who knows everything about oil and gas rocks. You give them a question like "What does this well log tell us about the Permian Basin?" and they go figure it out for you.

The geologist agent is like that friend, but it's software. You give it a question in plain English. It figures out which tools it needs to use (like a rock analysis tool, or a map tool), uses them one by one, and then writes you a clear answer. When it finds something important, it can write that finding to memory so future conversations pick it up.

## The five components

Every agent in the fleet implements five components: **Goal, Perception, Reasoning, Action, Memory** — the Observe→Think→Act→Learn→Repeat loop.

| Component | What it is | How geologist implements it |
|-----------|-----------|---------------------------|
| **Goal** | What the agent is trying to accomplish | `geologistManifest` — role, capabilities, tool inventory |
| **Perception** | How it reads the world | `callGeowizTool` reads well logs, GIS, seismic, documents, databases |
| **Reasoning** | How it decides what to do | `executeLoop` — ReAct loop driven by Claude (`standard-analysis` model from `modelRouting`) |
| **Action** | How it acts on the world | `runtime.execute()` — HITL gate, scope enforcement, evals fire on every tool call |
| **Memory** | How it learns across tasks | `geologist.save_finding` → geowiz findings store (local JSON; pgvector promotion via #405) |

## The two pieces

There are two separate pieces working together, like a doctor and their medical lab:

**The geowiz server (the lab)** — A collection of 9 specialized tools. Each tool does one specific thing:
- Analyze a well log file
- Process a map (GIS) file
- Read a geological database
- Assess data quality
- Process seismic data
- Process Aries database records
- **Save a finding to memory** ← new write tool

The server doesn't think — it just runs tools when asked. It is stateless, has no auth, and can be scaled horizontally.

**The geologist agent (the doctor)** — The smart governance layer. It:
1. Reads your question
2. Decides which tools to use
3. Calls the lab (geowiz server) with the right tool — through the Permission Gate
4. Reads the result
5. Decides if it needs more tools or if it can write a finding
6. Writes a final answer

## Step by step — formation analysis

```
You:      "Analyze the Permian Basin formation in test.las"
                              ↓
Agent thinks: "I need analyze_formation. Let me call that tool."
                              ↓
Runtime:  scope check (read:geology ✓) → HITL check (not sensitive ✓) → run handler
                              ↓
Agent calls:  geowiz server → analyze_formation(test.las)
                              ↓
Server returns: { porosity: 12%, netPay: 150ft, maturity: "Early Oil Window" }
                              ↓
Agent thinks: "Got the answer. Should I save this finding?"
                              ↓
[If saving] Runtime: HITL check (save_finding always needs approval) → human approves
                              ↓
Agent calls:  geowiz server → save_finding({ title, summary, confidence, dataSource })
                              ↓
You get:  "The Permian Basin formation shows 12% porosity with 150 feet of net pay,
           indicating an Early Oil Window maturity stage. This is a viable target..."
```

## The safety layer

Before the agent can use any tool, it goes through a safety checkpoint in `LocalAgentRuntime.execute()`:

1. **Scope check**: Does the caller have the required permission? (e.g., `read:geology`, `write:geology`) — blocked if missing and `grantedScopes` is provided.
2. **HITL gate**: Is this a sensitive or write action? `save_finding` always requires human approval. Analysis tools pass through in `when-sensitive` mode.
3. **Eval check**: After the tool runs, the output is evaluated — if a blocking eval (e.g., schema check, secret redaction) fails, the call returns `status: "failed"` instead of surfacing bad data.
4. **Audit log**: Every single tool call is recorded as a JSON line — timestamp, duration, status, model binding.

## Retry on transient failures

If geowiz is briefly unavailable (network blip, restart), the agent doesn't immediately give up. `executeWithRetry()` retries up to 3 times with exponential backoff:

```
Attempt 1 fails (RetryableToolError) → wait 500ms
Attempt 2 fails                      → wait 1000ms
Attempt 3 fails                      → wait 2000ms
Attempt 4 fails                      → surface to LLM as permanent error
```

Only `RetryableToolError` triggers retries. A bad argument or unknown tool (`PermanentToolError`) fails immediately.

## Model routing (BYOE)

The agent never hard-codes a model name in tool definitions. Instead, tools declare a capability label like `standard-analysis` or `deterministic`. The operator maps these labels to real models in `geologistConfig.modelRouting`:

```
"standard-analysis" → claude-sonnet-4-6   (can be overridden to any provider)
"deterministic"     → rule-based / no-model  (handler always returns structured data, no LLM)
```

This is BYOE — Bring Your Own Everything. An enterprise operator can route all calls through their own private LLM without touching the agent code.

## What's deferred

- **Context Injection (#395)**: Reading/writing memory namespace before/after the reasoning loop
- **Async Job (#396)**: Polling for long-running seismic processing tasks instead of blocking
- **pgvector promotion (#405)**: Promoting saved findings to Supabase pgvector for semantic recall

## The contract

The geologist agent follows the `AgentManifest` contract — a job description for software:
- "Here are my 9 tools (8 read, 1 write)"
- "Here's what each tool needs as input"
- "Here's what permissions are required"
- "Here's when a human needs to approve"
- "Here's my model routing table"

Any system that speaks the `AgentRuntime` language (orchestrator, Claude Desktop, test harness) can call the geologist the same way.
