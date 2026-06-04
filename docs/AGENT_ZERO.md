# Agent Zero Reference Contract

Agent Zero is the minimal standalone agent used to prove issue #358 before Geowiz migrates in issue #363.

It is not a domain expert. It is a contract sample.

## What Agent Zero Proves

Agent Zero proves that a standalone SHALE YEAH agent can:

- Validate an `AgentManifest`
- Validate runtime config
- Expose progressive discovery
- Resolve tool model needs through organization-owned config
- Return human-in-the-loop approval challenges
- Run configurable eval checks
- Redact sensitive input before handler execution
- Expose a transport-neutral endpoint facade

This lets us test the agent-company architecture before moving real Geowiz geology logic.

## Model-Agnostic Rule

SHALE YEAH does not decide which model an organization should use.

The platform defines model capability requirements. The organization maps those requirements to its own providers and models.

Examples of capability requirements:

- `small-fast`
- `standard-analysis`
- `deep-reasoning`
- `local-private`
- `deterministic`

Examples of organization-owned mappings:

```yaml
modelRouting:
  small-fast:
    provider: organization-small-model
    model: configured-by-operator
  deep-reasoning:
    provider: organization-deep-model
    model: configured-by-operator
  local-private:
    provider: organization-local-model
    model: configured-by-operator
  deterministic:
    provider: rule-based
    model: no-model
```

The deployed organization might map those aliases to Claude, OpenAI-compatible APIs, DeepSeek-style providers, Ollama, local SLMs, or any future BYOM adapter. The code should not care.

## Files

| File | Purpose |
| --- | --- |
| `src/agents/contracts.ts` | Shared manifest, runtime, HITL, eval, memory, and model-routing contract types |
| `src/agents/runtime.ts` | Local runtime implementation that validates config, resolves model routing, handles HITL, and runs basic evals |
| `src/agents/service.ts` | Transport-neutral endpoint facade for future HTTP/MCP adapters |
| `src/agents/agent-zero.ts` | Minimal reference agent manifest, config, and tool handlers |
| `tests/agent-runtime-contract.test.ts` | Contract tests for #358 |

## Run the Contract Test

```bash
npx tsx tests/agent-runtime-contract.test.ts
```

## Migration Rule

Do not copy Agent Zero as product behavior.

Use it as the contract harness. Geowiz should become the first real reference agent. After Geowiz is complete, save its final folder shape, manifest, MCP service, config schema, HITL policy, eval profile, memory flow, model-routing defaults, tests, docs, and mistakes learned into the context store.

