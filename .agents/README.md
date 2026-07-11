# Agent Operating Surface

This directory is the repo-local source of truth for agent workflow, guardrails, and SDLC rules.

Use this as the project contract for:

- issue templates
- spec-driven development
- planning gates
- hooks and command skills
- architecture decision rules
- build/test/verify expectations

This repository is CLI-agnostic. The rules here are meant to be readable by Codex, Anti-Gravity, or any other agent runtime that is taught to respect the same project contract.

## Canonical Rules

1. Each agent, MCP server, and orchestrator is an independently buildable project unit.
2. Each issue must define the role, operating mode, boundaries, and exit criteria.
3. Each issue must begin with a clear understanding statement and a definition of done.
4. Refactors remove displaced code instead of leaving old and new paths in parallel.
5. Shared contracts are allowed; hidden coupling is not.
6. Implementation follows spec, then plan, then build, then verify.

## Directory Layout

- `guardrails.md` - global project guardrails for agent work
- `sdlc.md` - the spec-driven development flow
- `command-skills.md` - repo-local command and workflow conventions
- `hooks/` - hook guidance and enforcement notes
