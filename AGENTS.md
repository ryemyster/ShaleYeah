# AGENTS.md

This file is the entry point for any coding agent working in this repo — Codex, Antigravity, Jules, Cursor, or otherwise. It is discovered automatically by tools that follow the [AGENTS.md convention](https://agents.md/). Claude Code uses `CLAUDE.md` instead; do not duplicate policy between the two — this file and `.agents/` are the source of truth for every non-Claude runtime.

Full policy detail lives in `.agents/` (tracked in git — never ignore it):

- `.agents/README.md` — canonical rules index
- `.agents/sdlc.md` — spec-driven development flow (spec → architecture decision → plan → build → verify → close)
- `.agents/guardrails.md` — scope, architecture-mode, and security rules
- `.agents/command-skills.md` — repo-local commands and package-level workflow conventions
- `.agents/hooks/` — enforced pre-commit checks and how to wire them

Read those before starting work. This file only summarizes what you need to get oriented.

## Repo shape

pnpm workspace monorepo, two-tier architecture:

- `sdk/` — `@shaleyeah/sdk`: shared contracts, LLM client, MCP base, parsers
- `servers/<name>/` — Tier 1 MCP tool servers
- `agents/<name>/` — Tier 2 agent packages (migrating to Google ADK; each agent is an independently buildable unit)
- `orchestrator/` — Temporal workflow orchestration

Each package under `agents/`, `servers/`, `sdk/`, and `orchestrator/` is its own project unit with its own build, tests, and docs. When a package has an `AGENTS.md` of its own, that file takes precedence over this one for work inside that package (nearest file wins).

## Non-negotiables

1. Branch from `develop`. Never commit directly to `develop` or `main`.
2. Tests before implementation — no code without a failing test first.
3. PRs target `develop` (`--base develop`), never `main`.
4. Update `CHANGELOG.md` under `[Unreleased]` and the affected package's docs before opening a PR.
5. Delete displaced code on refactors — do not leave old and new paths running in parallel unless the issue explicitly calls for a temporary adapter.
6. Never commit secrets, or place them in prompts/logs/agent memory.

## Commands

```bash
pnpm install
pnpm turbo build
pnpm turbo test
pnpm turbo type-check
pnpm turbo lint
```

Prefer package-local commands (`cd agents/<name> && pnpm test`) over root-level `turbo` runs when the change is scoped to one package.

## Hooks

`.agents/hooks/pre-commit` is a real, executable git hook — not just a checklist. See `.agents/hooks/README.md` for what it checks and how to enable it (`git config core.hooksPath .agents/hooks`).
