# Architecture — @shaleyeah/orchestrator

> **Status: Planned — #362**

## Role

The orchestrator is the coordination layer above the two-tier fleet. It does not do domain analysis — it drives agents through structured workflows using Temporal.

## Planned topology

```
Orchestrator (Temporal worker)
  ├── DealWorkflow
  │     ├── Activity: invoke geologist agent (port 4001)
  │     ├── Activity: invoke economist agent (port 4002)
  │     ├── Activity: invoke drilling-engineer agent (port 4003)
  │     ├── ... (all 14 agents in parallel)
  │     └── Activity: invoke reporter agent (port 4009) with assembled results
  └── BidWorkflow
        ├── Activity: invoke investment-chair agent (port 4013)
        └── Activity: invoke reporter agent (port 4009)
```

## Why Temporal

Temporal provides durable execution — if a worker crashes mid-workflow, the workflow resumes exactly where it left off. This is critical for long-running deal workflows where any individual agent call might take seconds or fail transiently.

## Transport

The orchestrator calls Tier 2 agents over HTTP (LocalAgentEndpoint). It does not call Tier 1 servers directly — that is the agents' job.

## SDK dependency

```
@shaleyeah/orchestrator
  └── @shaleyeah/sdk   (AgentManifest, AgentRuntimeConfig contracts)
```

The orchestrator does not extend `MCPServer` — it is a Temporal worker, not an MCP server.

## Current state

Stub only. `src/index.ts` exports `ORCHESTRATOR_VERSION = "0.1.0"`. No workflow logic. See issue #362.
