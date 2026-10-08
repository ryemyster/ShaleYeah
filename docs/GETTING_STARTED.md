# Getting Started

Choose the package you are changing, then use its own install and verification
commands. ADK (Google Agent Development Kit) employees use Python. MCP (Model
Context Protocol) servers expose tools and use TypeScript. A root TypeScript
build does not run every employee's Python tests or evaluate its job performance.

The project is being rebuilt through the [MVP plan](mvp-release-plan.md).
[Deployment support](deployment-support.md) records the bounded local evidence
and remaining portability/production gaps; setup success is not enterprise
readiness.

## Prerequisites

- Git; `gh` authenticated with repository read/write access for issue/PR delivery.
- Node.js 22 or newer for the TypeScript workspace and delivery command.
- The pnpm version declared by root `package.json`: currently `pnpm@11.5.1`.
- uv and Python 3.12 for the reference employee and CI parity. Geologist accepts
  `>=3.11,<3.14`; contracts accepts `>=3.11,<3.15`. Check the owning manifest for
  other packages rather than assuming every package supports Python 3.14.
- agents-cli for ADK employee work. CLI 1.3.1 was inspected for these commands;
  use `--help` to verify another version instead of silently upgrading/scaffolding.
- Optional provider/grading credentials for live model/eval runs. Locked
  install/import and deterministic fixtures do not require a model key.

## Install

```bash
git clone https://github.com/ryemyster/ShaleYeah.git
cd ShaleYeah
git switch develop
pnpm install --frozen-lockfile
pnpm sdlc install
pnpm sdlc status
```

The install is the current **workspace** dependency setup, not proof that each
package can be copied out independently. `sdlc install` enables shared Git guards
and local skill bindings for Codex, Antigravity and Claude Code. Their personal
instructions stay local; contributors do not need the maintainer's ignored
`.agents/` notes. See [the delivery guide](sdlc.md) for details and recovery.

## Select the owning package

| Work | Start here | Verification |
| --- | --- | --- |
| ADK employee reasoning, instructions or tools | [Geologist reference](../agents/geologist/README.md), then the chosen `agents/<role>/README.md` | Locked uv install; Python tests/import/syntax; agents-cli project inspection; configured evals when behavior is ready |
| MCP tools, parsers or source integration | [Geowiz reference](../servers/geowiz/README.md), then the chosen `servers/<name>/README.md` | Build SDK first; owning pnpm build/type-check/lint/test scripts |
| Shared business records | [contracts/README.md](../contracts/README.md) | Python/TypeScript parity, coverage and isolated install |
| Shared TypeScript helpers | [sdk/README.md](../sdk/README.md) | SDK scripts and checks for affected consumers |
| Optional coordination | [orchestrator/README.md](../orchestrator/README.md) | Its documented runtime/dependencies and package scripts |

Four employees still have temporary TypeScript implementations. The
[migration ledger](legacy-migration-ledger.md) names their owners; use those
packages' current instructions while migrating them. New employee code belongs
in a package-local ADK/Python project, never a root scaffold or a new npm agent.

## Check an ADK employee

From `agents/geologist`, install its committed dependencies and inspect it:

```bash
uv sync --frozen --extra eval
uv run --frozen pytest -q
uv run --frozen python -m py_compile app/agent.py app/geowiz_mcp.py
uv run --frozen python -c 'from app.agent import app, root_agent; print(app.name, root_agent.name)'
agents-cli info
```

`info` must identify this package, not the repository root. The current eleven
tests inspect project/tool/eval **shape**, not professional geological behavior.
The manifest currently has deployment target `none` and in-memory sessions.

Its eval cases live in
[tests/eval/datasets/geologist-adk-reference.json](../agents/geologist/tests/eval/datasets/geologist-adk-reference.json);
its metric selection/rubrics live in
[tests/eval/eval_config.yaml](../agents/geologist/tests/eval/eval_config.yaml).
Follow [the package's eval steps](../agents/geologist/docs/LOCAL_TESTING.md#run-adk-evals)
for live inference/grading prerequisites and artifact locations. Keep
deterministic policy checks, model-based scores and human professional review
distinct. Portable config-driven evaluation and promotion gates remain
#666/#667/#577; a file's presence does not prove the employee passes it.

## Check an MCP tool

From the repository root, build dependencies and the owning package:

```bash
pnpm --dir sdk build
pnpm --dir servers/geowiz build
pnpm --dir servers/geowiz type-check
pnpm --dir servers/geowiz lint
pnpm --dir servers/geowiz test
```

Use [the ordered reference deployment guide](deployment-support.md#run-the-current-reference-locally)
to start Geowiz and then Geologist. It explains private development ingress,
actual ports/credentials, fixture paths on the tool host and current state/review
limits. Choose the matching server README for another tool; do not copy a model
key into a desktop config, prompt, command or artifact.

## Shared workspace verification

For shared workspace/CI changes or contracts used across packages, also run from
the repository root:

```bash
pnpm check:issue-template
pnpm test:sdlc
pnpm turbo type-check
pnpm turbo lint
pnpm turbo build
pnpm turbo test
pnpm --dir contracts check:isolation
```

These transitional workspace checks do not replace Python package checks or
live employee evals. [Contracts](../contracts/README.md) also documents its
package-local Python/TypeScript parity commands.

## Deliver one issue

Work starts with an open, approved issue in dependency order. From the root,
replace the example issue number/slug with that issue's values:

```bash
pnpm sdlc start <issue-number> <slug>
pnpm sdlc status
```

`start` fetches current develop and registers one branch. Write failing tests or
the documentation/research evidence checklist **before implementation**. Finish
that outcome, delete displaced code, update affected docs/changelogs and verify
the owning packages. Commit/push that branch and open one PR with base `develop`,
`Fixes #<issue-number>` and `SDLC-Base: <active.baseSha>` from status.

After review and green PR checks, merge through GitHub. Wait for successful push
checks on the exact merged develop commit and verify issue acceptance, then run:

```bash
pnpm sdlc complete <merged-pr-number>
```

Completion closes the issue, synchronizes develop and releases the slot. Only
then start the next issue. An open PR is pending work. Main promotion is a
separate release after candidate qualification and named human MVP acceptance
(#693/#694/#695); [PR #703](https://github.com/ryemyster/ShaleYeah/pull/703) monitors
develop and is not permission to release.

Read [CONTRIBUTING.md](../CONTRIBUTING.md) for issue/test/review standards,
[docs/sdlc.md](sdlc.md) for enforcement/recovery, and
[topology](topology.md) plus [current architecture](ARCHITECTURE.md) for package
boundaries. Do not discard work or bypass hooks to clear a delivery slot.
