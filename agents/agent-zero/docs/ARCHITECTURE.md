# Architecture — @shaleyeah/agent-zero

Agent Zero is the fleet coordinator. It holds a full `AgentRuntimeConfig` that maps model routing preferences, HITL policy, eval requirements, and memory config across all agents.

## Dependencies

```
agents/agent-zero
  └── @shaleyeah/sdk  (AgentManifest, AgentRuntime, AgentService contracts)
```
