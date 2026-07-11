# Guardrails

These rules apply to all agent work in this repository.

## Scope

- Work in small, independent blocks.
- Keep each agent/MCP/orchestrator unit independently buildable.
- Prefer deletion over layering new code on top of legacy code.
- Do not introduce hidden cross-package coupling.
- Treat shared packages as contracts, not as a dumping ground.

## Architecture Rules

- Use stand-alone mode by default unless the issue explicitly requires another mode.
- Use hierarchical mode only when a role needs child agents.
- Use graph-based orchestration only when business logic, routing, or HITL requires it.
- Use ambient mode only for background/event-driven work.
- Use capability-first routing as an optimization layer, not the core architecture.

## Security Rules

- Never commit secrets.
- Never place secrets in prompts, logs, or memory by default.
- Use explicit auth and approval boundaries for sensitive actions.
- Keep auditability and redaction requirements visible in every relevant issue.

## Verification Rules

- Every implementation issue needs a spec and acceptance criteria.
- Every migration issue needs tests and a deletion plan for displaced code.
- Every runtime-facing feature needs observability and failure behavior defined.

