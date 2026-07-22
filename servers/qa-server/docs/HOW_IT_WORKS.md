# How QA Server Works — @shaleyeah/server-qa

## Plain language (12-year-old version)

After a fleet of 14 expert servers has all run, how do you know their outputs are actually trustworthy? The QA Server is the quality inspector — it evaluates whether the other servers are returning accurate, consistent, well-formed results, and generates a report about the health of the whole system.

You tell it which servers to check and what accuracy level you expect. It tests them and tells you: pass or warning, what problems it found, and what to fix.

## Technical explanation

QA Server is a **Tier 1 MCP tool server** — stateless. It exposes 2 quality assurance tools backed by LLM synthesis.

### Tool inventory

| Tool | What it does |
|------|-------------|
| `run_quality_tests` | Validate server outputs against expected schemas and accuracy thresholds |
| `generate_quality_report` | Quality report with overall status, issues list, and recommendations |

### Request lifecycle

```
Agent (quality-assurance)
  → MCP tool call: run_quality_tests { servers, accuracyThreshold }
      ↓
  QA Server (src/index.ts)
      ↓
  1. callLLM(quality assessment prompt)
     OR fallback: deriveDefaultQAResult(servers, accuracyThreshold)
  2. Return: { status, issues, recommendations }
```

### Fallback logic

`deriveDefaultQAResult()` is deterministic:
- `accuracyThreshold >= 0.99` + multiple servers → "WARNING"
- `accuracyThreshold = 0.95` + single server → "PASS"

### Transport modes

- **stdio** (default): pipe-based
- **HTTP** (when `PORT=3014`): `StreamableHTTPServerTransport` — used by the quality-assurance agent
