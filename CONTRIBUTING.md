# Contributing to SHALE YEAH

## Setup

```bash
git clone https://github.com/ryemyster/ShaleYeah.git
cd ShaleYeah
pnpm install
pnpm turbo build
pnpm turbo test
```

## Branching

Branch from `develop`. PRs target `develop` — never `main` directly.

```bash
git checkout develop
git checkout -b issue-<number>-<slug>
```

## Work Model

Use a spec-driven, issue-first workflow.

1. Write implementation work with the **Implementation Spec** issue template.
2. Record the role, use case, operating mode, boundaries, inputs, outputs, HITL, memory, runtime, tests/evals, trust notes, topology impact, deletion/migration notes, non-goals, and dependencies.
3. Include Given/When/Then behavior and at least one failure case.
4. Get maintainer approval on the issue plan before code changes.
5. Build on a branch cut from `develop`.
6. Run the full local lifecycle for the affected package(s).
7. Keep displaced code deleted unless an adapter is explicitly required.
8. Open a PR back into `develop` when the unit is clean.

Issue classes:

- Isolated work: branch from `develop`, build, verify, PR back to `develop`.
- Cross-issue work: treat as asynchronous and block on the upstream issue or contract.
- Process-only work: use the template, mark runtime and memory as not applicable, and still define verification.

The template is enforced in two places:

- GitHub issue forms require the implementation fields when creating a new implementation issue.
- `pnpm check:issue-template` verifies that the required spec fields, planning gate, failure case prompt, and deletion/migration prompt remain present in the template.

## Local Agent Tooling

`.agents/` and `AGENTS.md` are maintainer-local dev environment files — gitignored, not part of this repository's tracked contract. They hold one contributor's working notes for driving Codex/Antigravity sessions against this repo and are not required to build, test, or contribute.

The tracked source of truth for architecture and target state is [`docs/topology.md`](docs/topology.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Security and Verification

This project expects TDD and security coverage to travel together.

- Add or update tests before or during implementation.
- Use package-local verification first.
- Keep secrets out of prompts, logs, and memory.
- Add explicit audit, redaction, and approval behavior for sensitive flows.
- Prefer small changes that can be verified independently.

## Pre-commit gate

All five must pass before opening a PR:

```bash
pnpm turbo build
pnpm turbo type-check
pnpm turbo lint
pnpm turbo test
```

Run per-package during development:

```bash
cd servers/geowiz && pnpm build && pnpm test
cd agents/geologist && pnpm build && pnpm test
cd sdk && pnpm build && pnpm test
```

## Adding a new MCP server

1. Create `servers/<name>/` — copy structure from an existing server (e.g. `servers/legal/`)
2. Extend `MCPServer` from `@shaleyeah/sdk`, give it a Roman persona, register tools with `registerTool()`
3. Wire `callLLM()` from `@shaleyeah/sdk` — never import `@anthropic-ai/sdk` directly
4. Add `servers/<name>/package.json` with `"@shaleyeah/sdk": "workspace:*"` dep
5. Write three tests in `servers/<name>/tests/server.test.ts` (see Anti-Stub Pattern below)
6. Add `servers/<name>/docs/ARCHITECTURE.md` and `.env.example`
7. Add to `pnpm-workspace.yaml` if not already covered by `servers/*`

## Anti-stub test pattern

Every server that calls `callLLM` must have all three types. These exist because servers were previously ghost-closed with hardcoded stubs while tests passed.

**Type 1 — Mock-SDK:** prove `messages.create` is actually called.

```typescript
process.env.ANTHROPIC_API_KEY = "sk-ant-api03-fake-key-for-testing-purposes-only-00000000000000000000000000";
let err: Error | null = null;
try { await callLLM({ prompt: "..." }); } catch (e) { err = e as Error; }
assert.ok(err !== null);
assert.ok(!err.message.includes("environment variable is not set")); // SDK was reached, not our guard
```

**Type 2 — Determinism:** different inputs → different outputs (hardcoded returns fail this).

```typescript
const r1 = deriveDefault("California", "exploration");
const r2 = deriveDefault("Texas", "production");
assert.notStrictEqual(r1, r2);
```

**Type 3 — Demo-fallback:** no key → clean error from `callLLM`, not a crash.

```typescript
delete process.env.ANTHROPIC_API_KEY;
let threw = false;
try { await callLLM({ prompt: "test" }); } catch { threw = true; }
assert.ok(threw);
```

## Adding a new agent

1. Copy `agents/agent-zero/` as the starting point — it is the reference contract implementation
2. Implement `AgentManifest` with tools, scopes, model requirements, and eval profiles
3. Implement `AgentRuntimeConfig` with HITL policy, evals, memory, and `mcpServers` wiring
4. Write handlers that call the corresponding Tier 1 server's exported functions
5. Write tests (`agents/<name>/tests/agent.test.ts`) covering manifest validation, runtime boot, and HITL
6. Add `agents/<name>/docs/ARCHITECTURE.md` — see `agents/geologist/docs/ARCHITECTURE.md` for the pattern

## Test pattern

All tests use Node's built-in `assert` — no jest, no vitest. Tests must pass without `ANTHROPIC_API_KEY`.

```typescript
import assert from "node:assert";

let passed = 0; let failed = 0;
function test(name: string, fn: () => void | Promise<void>) { ... }

await test("does the thing", () => {
  assert.strictEqual(actual, expected, "message");
});
```

Run a single test: `npx tsx servers/geowiz/tests/server.test.ts`

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
