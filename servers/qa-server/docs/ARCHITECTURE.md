# Architecture — @shaleyeah/server-qa

## Role

Tier 1 MCP tool server. Quality assurance tooling — runs validation suites against other servers and generates quality reports. Paired with the `quality-assurance` agent (port 4014).

## Tool inventory

| Tool | Handler | LLM? | Purpose |
|------|---------|------|---------|
| `run_quality_tests` | LLM | ✅ `callLLM` | Run quality test suite against specified servers |
| `generate_quality_report` | LLM | ✅ `callLLM` | Quality report with status, issues, recommendations |

## LLM + fallback pattern

Both tools call `callLLM()` for synthesis. Falls back to `deriveDefaultQAResult()` if the API is unavailable — `accuracyThreshold >= 0.99` with multiple servers produces "WARNING"; `0.95` with one server produces "PASS".

## Key exports

`deriveDefaultQAResult(servers, accuracyThreshold)` — deterministic fallback, exported for anti-stub testing.

## Transport modes

- **stdio** (default): used by Claude Desktop and MCP CLI
- **HTTP** (when `PORT=3014`): `StreamableHTTPServerTransport` — used by the agent fleet

## Data flow

```
MCP tool call: run_quality_tests { servers, accuracyThreshold }
  → callLLM(quality assessment prompt)
  ↘ fallback: deriveDefaultQAResult(servers, accuracyThreshold)
  → Return: { status, issues, recommendations }
```

## Dependencies

```
@shaleyeah/server-qa
  └── @shaleyeah/sdk   (MCPServer, callLLM)
```
