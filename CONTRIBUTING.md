# Contributing to SHALE YEAH

## Setup

Follow [Getting Started](docs/GETTING_STARTED.md) for the ordered checkout,
locked dependency setup and package selection. Use Node 22 or newer, the root
`packageManager` version of pnpm, and uv with Python 3.12 for the reference
employee. ADK (Google Agent Development Kit) employees use Python; MCP (Model
Context Protocol) tool servers use TypeScript. Install agents-cli only when
working on an ADK employee; install/authenticate `gh` for issue and PR delivery.

Choose the owning package before running checks. Root Turbo checks cover the
transitional TypeScript workspace, not every Python employee or its live evals.
The shared [contracts package](contracts/README.md) checks business records in
both languages. [Deployment support](docs/deployment-support.md) separates local
setup evidence from portable/hosted support that still needs qualification.

## Branching

Branch from `develop`. Implementation PRs target `develop`.

Deliver issues sequentially: finish one issue's PR, merge it into `develop`, verify
the merged checks, synchronize `develop`, then start the next issue. See
[`docs/sdlc.md`](docs/sdlc.md) for the command, Git hooks and coding-agent setup.
Use [`docs/mvp-release-plan.md`](docs/mvp-release-plan.md) for the MVP issue order,
dependencies and acceptance evidence. Complete one issue through develop before
starting the next.

The release exception is a reviewed `develop` → `main` PR after exact candidate
qualification and named human MVP acceptance in the [release plan](docs/mvp-release-plan.md#mvp-entry-exit-and-release-gates).
Do not merge the rolling [monitor PR #703](https://github.com/ryemyster/ShaleYeah/pull/703)
as an implementation shortcut.

```bash
pnpm sdlc install
pnpm sdlc start <number> <slug>
# Implement, verify, review and merge one PR into develop.
pnpm sdlc complete <merged-pr-number>
# Only now start the next issue.
```

## Work Model

Use a spec-driven, issue-first workflow.

1. Write implementation work with the **Implementation Spec** issue template.
2. Record the role, use case, operating mode, boundaries, inputs, outputs, HITL, memory, runtime, tests/evals, trust notes, topology impact, deletion/migration notes, non-goals, and dependencies.
3. Include Given/When/Then behavior and at least one failure case.
4. Get maintainer approval on the issue plan before code changes.
5. Start one issue with `pnpm sdlc start`, which cuts its branch from freshly fetched `develop`.
6. Write failing tests/evals before implementation, then implement and verify the
   affected package(s). For a documentation/research outcome, record the evidence
   checklist before drawing conclusions.
7. Keep displaced code deleted unless an adapter is explicitly required.
8. For agent migrations, ADK/Python is the target surface. A lingering `agents/<name>/package.json`, `tsconfig.json`, `biome.json`, `src/agent/`, or TypeScript agent test suite is migration debt unless the issue is explicitly deleting or temporarily adapter-gating it.
9. Open a PR back into `develop` when the unit is clean.
10. Merge after verification and review, wait for merged CI, verify acceptance, and run `pnpm sdlc complete` before starting another issue. Opening a PR does not close an issue.

Issue classes:

- Isolated work: start from refreshed `develop`, build, verify, merge one PR, and complete before the next issue.
- Cross-issue work: finish upstream issues in dependency order; each downstream branch includes the merged upstream contract.
- Process-only work: use the template, mark runtime and memory as not applicable, and still define verification.

The template is enforced in two places:

- GitHub issue forms require the implementation fields when creating a new implementation issue.
- `pnpm check:issue-template` verifies that the required spec fields, planning gate, failure case prompt, and deletion/migration prompt remain present in the template.

## Local Agent Tooling

`.agents/` and `AGENTS.md` are maintainer-local dev environment files — gitignored, not part of this repository's tracked contract. They hold one contributor's working notes for driving Codex/Antigravity sessions against this repo and are not required to build, test, or contribute.

The tracked source of truth for architecture and target state is [`docs/topology.md`](docs/topology.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Shared development tooling lives in `scripts/`; `pnpm sdlc install` creates local skill bindings for Codex, Antigravity and Claude Code without tracking their personal runtime directories.

## Security and Verification

This project expects TDD and security coverage to travel together.

- Add or update failing tests before implementation.
- Use package-local verification first.
- Keep secrets out of prompts, logs, and memory.
- Add explicit audit, redaction, and approval behavior for sensitive flows.
- Prefer small changes that can be verified independently.

## Pre-commit gate

Run the checks that match the touched package boundary before every commit and
PR. Update root/package changelogs and affected docs, review the diff, and scan
staged changes for secrets. Shared delivery hooks enforce issue ordering; they
do not replace useful tests, review or package quality checks.

From the repository root, TypeScript tool work uses the package's own scripts:

```bash
pnpm --dir sdk build
pnpm --dir servers/geowiz build
pnpm --dir servers/geowiz type-check
pnpm --dir servers/geowiz lint
pnpm --dir servers/geowiz test
```

For Geologist, run from `agents/geologist` after its locked setup:

```bash
uv run --frozen pytest -q
uv run --frozen python -m py_compile app/agent.py app/geowiz_mcp.py
uv run --frozen python -c 'from app.agent import app, root_agent; print(app.name, root_agent.name)'
agents-cli info
```

These existing Python tests inspect package/tool/eval shape. Live task behavior,
professional correctness and backend review enforcement require separate
evidence. Follow the package's [evaluation steps](agents/geologist/docs/LOCAL_TESTING.md#run-adk-evals)
when that behavior is ready; record dataset/config/provider/judge versions and
per-case results. Do not relabel shape tests or a healthy port as employee evals.

For shared workspace files, cross-package contracts or CI changes, also run:

```bash
pnpm turbo build
pnpm turbo type-check
pnpm turbo lint
pnpm turbo test
pnpm check:issue-template
pnpm test:sdlc
```

Contracts have their own parity/coverage and extracted-install checks; follow
[their README](contracts/README.md). Each other package's README declares its
checks. No provider key is needed for the deterministic CI fixtures. A live
model or grading service needs its separately configured credentials and may
incur cost; never embed keys in commands, prompts, eval fixtures or artifacts.

## Adding a new MCP server

1. Start an approved issue and write failing contract, tool and trust tests.
2. Create `servers/<name>/` using an existing server's package-local shape.
3. Use shared SDK server/tool patterns and a Roman display persona. Keep stable
   role/capability IDs separate from the display name.
4. Use the shared LLM client when synthesis is needed; never import a provider
   SDK directly in the server. Preserve deterministic tools where they suffice.
5. Declare package dependencies/scripts. Current SDK consumers use
   `"@shaleyeah/sdk": "workspace:*"`; independent packaging is owned by #674.
6. Add README, architecture/deployment docs, non-secret config examples and
   control, edge and authority tests. A health check alone is insufficient.
7. `servers/*` is already covered by `pnpm-workspace.yaml`. Change the workspace
   list only if introducing a different boundary.

## Anti-stub test pattern

For model-assisted tools, test these boundaries before implementation:

- The shared client/provider method is actually invoked, using an isolated
  fixture or mock. An authentication failure proves an invocation boundary,
  not a valid professional result.
- Meaningfully different inputs affect the tool request or deterministic result;
  hardcoded estimates cannot satisfy the source/domain acceptance case.
- A missing provider key or unavailable source produces an explicit failure or
  deferral, not fabricated data presented as analysis.

The [existing Geowiz tests](servers/geowiz/tests/server.test.ts) show current
invocation and missing-key checks. Mock/placeholder processor fixtures are not
professional format qualification; #671/#674 supply reference evidence.

## Adding a new agent

1. Start an approved issue, choose one architecture mode and define the role's
   tests/evals and human-review boundary before implementation.
2. Start with a package-local ADK/Python project shape under `agents/<name>/`.
   Inspect an existing package before scaffolding; never scaffold the repo root.
3. Choose the stable agent id (`market-analyst`, `title-analyst`, ...).
4. Add `agents-cli-manifest.yaml`, `pyproject.toml`, `uv.lock`, `app/agent.py`, and package-local evals.
5. Keep MCP/tool backend logic in the matching `servers/<name>/` package. Servers may remain TypeScript and use pnpm.
6. Do not add a new agent `package.json`, `tsconfig.json`, `biome.json`, `src/agent/`, or npm script surface.
7. Add package docs (`README.md`, `docs/`) and eval coverage with control, edge, and capability-boundary cases.
8. Add `agents/<name>/docs/ARCHITECTURE.md` — see `agents/geologist/docs/ARCHITECTURE.md` for the ADK boundary pattern.

## Test pattern

TypeScript package tests use Node's built-in `assert`; Python packages use
pytest. Deterministic tests must pass without provider keys. Write them first
and run the owning package's test command so its runner reports failures.

```typescript
import assert from "node:assert";

let passed = 0; let failed = 0;
function test(name: string, fn: () => void | Promise<void>) { ... }

await test("does the thing", () => {
  assert.strictEqual(actual, expected, "message");
});
```

From `servers/geowiz`, run a single TypeScript file with
`pnpm exec tsx tests/server.test.ts`; use `pnpm test` for the package suite.
From `agents/geologist`, run a single Python file with
`uv run --frozen pytest tests/test_adk_project_shape.py`.

## Code standards

- TypeScript strict mode — no `any` except the two sdk files that need Zod runtime interop
- No `Math.random()` in business logic — deterministic constants only (Monte Carlo samplers in risk-analysis are the explicit exception)
- Comments explain the *why*, not the what — if removing the comment wouldn't confuse a future reader, don't write it
- No `z.any()` in Zod schemas — use explicit types

## Changelog

Add an entry under `[Unreleased]` in the relevant package's `CHANGELOG.md` before opening a PR. Root `CHANGELOG.md` for workspace-level changes.

## Security

Never commit secrets or credentials. Read from environment variables. See [SECURITY.md](SECURITY.md).

## License

Contributions are licensed under Apache 2.0. See [LICENSE](LICENSE).
