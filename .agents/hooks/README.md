# Hooks

This directory contains real, executable git hooks for agent-driven development — Codex, Antigravity, or manual use. These are guardrails, not hidden automation: every check prints what it's doing and why, and only `pre-commit` currently blocks a commit.

## Enable

```bash
git config core.hooksPath .agents/hooks
```

This is per-clone, not committed to `git config` — every agent runtime (and every human) working in this repo should run it once. It does not require Husky, npm, or any Node tooling, so it works identically for Codex, Antigravity, and manual git use.

## `pre-commit`

Runs on every `git commit`. Checks, in order:

1. **Secrets and credential leakage** — runs `gitleaks protect --staged` if gitleaks is installed (`brew install gitleaks`). Blocks the commit on a match.
2. **Missing docs for a new package boundary** — if staged files add to a new `agents/<name>/` or `servers/<name>/` directory, requires that package to have a `README.md`. Blocks the commit if missing.
3. **Missing tests** — warns (does not block) if `.ts` source files are staged under a package's `src/` with no staged `*.test.ts` anywhere in the commit. TDD per `.agents/sdlc.md` is a discipline the hook can nudge on, not mechanically enforce — a commit can legitimately touch source with tests staged in an earlier commit.
4. **`.agents/` must stay tracked** — fails if `.agents/` has been gitignored, since `AGENTS.md` at the repo root depends on it.

## Not yet automated

These are still manual review gates, not hook-enforced:

- **pre-push** — no hook yet; rely on `pnpm turbo build/test/lint` before pushing.
- **PR review checklist** — enforced by human/agent review against `.agents/sdlc.md` Step 5 (Verify) and Step 6 (Close), not by a script.
- **Spec approval gate** — Step 1/2 of `.agents/sdlc.md` (spec + architecture decision) happens in the issue itself, before any hook runs.
- **Schema/contract drift** and **legacy code left behind after a refactor** — these require semantic judgment (is this displaced code intentional, is this contract change backward compatible) that a shell script can't reliably make; treat them as PR review items per `.agents/guardrails.md`.

Extend this script rather than bypassing it if a new mechanical check becomes worth enforcing.

