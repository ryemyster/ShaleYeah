# How the Orchestrator Works — @shaleyeah/orchestrator

> **Status: Planned — #362**

## Plain language (12-year-old version)

Imagine you're the project manager for a big oil deal. You need 14 different experts to each do their job, then compile all their findings into one report. You could call each one manually — but that takes forever and if one fails, you lose track of everything.

The Orchestrator is your automation. You say "run a full deal analysis on this property," and it calls all 14 experts at once, waits for them to finish, handles any that need to retry, collects all the results, and sends them to the reporter to write the final document. If your computer crashes halfway through, it picks up exactly where it left off.

## Technical explanation

The orchestrator is a **Temporal workflow worker** — planned for issue #362. It sits above the two-tier fleet and drives multi-agent deal workflows.

### Planned workflow lifecycle

```
Client calls DealWorkflow("Permian Basin Acquisition")
  ↓
Temporal schedules workflow execution
  ↓
Worker fans out 14 parallel Activities:
  → geologist agent (port 4001)
  → economist agent (port 4002)
  → ... all 14 agents
  ↓
Worker collects all results (retries on error_type: "retryable")
  ↓
Worker calls reporter agent with assembled results
  ↓
Returns complete deal package
```

### Durable execution

If the worker crashes mid-workflow, Temporal replays history and resumes from the last completed activity. No domain analysis is lost.

### Current state

Stub only. See issue #362.
