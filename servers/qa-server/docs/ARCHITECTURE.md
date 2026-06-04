# Architecture — @shaleyeah/server-qa

## Role

Tier 1 MCP tool server. Quality assurance tooling — runs validation suites against other servers and generates quality reports.

## Tools

| Tool | LLM? | Purpose |
|------|------|---------|
| `run_quality_tests` | ✅ `callLLM` | Run quality test suite against specified servers |
| `generate_quality_report` | ✅ `callLLM` | Quality report with status, issues, recommendations |

## Key exports

`deriveDefaultQAResult(servers, accuracyThreshold)` — deterministic fallback. `accuracyThreshold >= 0.99` with multiple servers produces "WARNING"; `0.95` with one server produces "PASS".

## Dependencies

```
@shaleyeah/server-qa
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
