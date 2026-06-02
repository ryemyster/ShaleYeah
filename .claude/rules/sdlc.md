# SDLC Rules — Non-Negotiable

Every issue, no matter how small, requires all of these before the PR is opened:

1. **Branch from develop** — `git checkout develop && git checkout -b <issue>-<slug>`. Never commit on develop or main directly.

2. **Tests first (TDD)** — Write failing tests before implementation. No implementation without a test.

3. **Docs update (mandatory)** — Run `/update-docs` after every code change. Never skip. Maps:
   - `src/kernel/` touched → `docs/ARCHITECTURE.md`, `docs/API_REFERENCE.md`
   - `src/servers/<name>.ts` touched → `docs/SERVERS.md`, README agent table, `docs/DEMO_VS_PRODUCTION.md`
   - New Arcade pattern implemented → `docs/ARCADE-PATTERNS.md` status row + coverage summary
   - New term introduced → `docs/GLOSSARY.md`

4. **CHANGELOG.md entry** — Under `[Unreleased]` before every commit.

5. **Pre-commit gate** — All five must pass: `npm run build && npm run type-check && npm run lint && npm run test && npm run demo`. Coverage gate: `npm run coverage` (lines ≥90%, functions ≥85%, branches ≥80%).

6. **PR targets develop** — Always `gh pr create --base develop`. Never omit `--base develop`.

## What "done" means

A task is NOT done when the code works. It is done when:
- Tests pass ✅
- Docs updated ✅
- CHANGELOG entry written ✅
- Pre-commit gate passes ✅
- PR opened to develop ✅

Skipping any of these is the same as not finishing the task.
