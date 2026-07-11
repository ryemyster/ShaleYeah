# Command Skills

These are repo-local workflow conventions for agent runs.

## Common Commands

- Current workspace convention: `pnpm install`
- Current workspace convention: `pnpm turbo build`
- Current workspace convention: `pnpm turbo test`
- Current workspace convention: `pnpm turbo type-check`
- Current workspace convention: `pnpm turbo lint`

These commands describe the present repo workflow, not a permanent architecture rule. If the refactor removes root orchestration, update this file to match the new package-local flow.

## Package-Level Development

Work in the owning package when possible:

- `sdk/`
- `agents/<name>/`
- `servers/<name>/`
- `orchestrator/`

## Workflow Rules

- Prefer package-local tests first.
- Prefer the smallest affected package set.
- Prefer explicit package READMEs and docs over repo-wide assumptions.
- When a boundary changes, update the package docs and the topology docs together.
