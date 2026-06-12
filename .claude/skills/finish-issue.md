# finish-issue

Complete and ship a finished issue: run pre-commit checks, update the changelog, push the branch, open a PR to `develop`, and close the issue.

## Usage

`/finish-issue <issue-number>`

## Steps

1. **Load context via context-engine:**

   Use the `load_context` MCP tool:
   - `task`: `"Finish issue: <issue title>"`
   - `paths`: `["ryemyster/ShaleYeah/sdk/src", "ryemyster/ShaleYeah/servers", "ryemyster/ShaleYeah/agents"]`
   - `focus`: the issue slug

   Note `suggested_files` and `risks` from the result before proceeding. Skip if unreachable.

1b. **Draft delegation gate** — After loading context, check if the task is mechanical:
   - Single file to change, clear spec from the issue body, no architecture decisions → `POST /draft` via curl
   - Multi-file mechanical work → `POST /scaffold` via curl
   - Novel architecture, auth/security paths, complex multi-system logic → skip delegation, implement directly

   For mechanical single-file work:
   ```bash
   curl -s -X POST http://localhost:8088/draft \
     -H "Content-Type: application/json" \
     -d '{"path": "ryemyster/ShaleYeah/<file>", "task": "<spec from issue body>"}'
   ```
   Read `~/Library/Application Support/context-store/artifacts/draft-*.md`, verify against the issue spec, then apply.

2. **Fetch issue details from GitHub**:

   ```bash
   gh issue view <issue-number> --json title,body,state,labels
   ```

   Read the acceptance criteria and TDD checklist from the issue body. Verify the issue is open (state: OPEN). Use the issue title as the basis for the PR title and commit message.

2. **SDLC Guard** — Confirm the branch was cut from the issue, not the other way around:

   ```bash
   git log --oneline develop..HEAD
   ```

   If the first commit predates the issue creation date (check `gh issue view <number> --json createdAt`), flag it in the PR description as "branch cut before issue was filed."

3. **Ghost-Close Guard** — Before running pre-commit, verify implementation exists:

   - Server issues: `grep -r "callLLM" servers/<name>/src/`
   - SDK issues: `grep -r "<new-export>" sdk/src/`
   - Agent issues: `grep -r "<new-export>" agents/<name>/src/`
   - Other: grep for the primary new symbol in the relevant source file

   If grep returns nothing: STOP — the issue is not implemented. Do not close.

4. **Pre-commit checks** — Run `/pre-commit`. Stop if anything fails. This includes type-checking — fix any type errors before proceeding.

5. **CHANGELOG.md** — Add an entry under `[Unreleased]` describing the change. Use the format:

   ```
   ### Added / Fixed / Changed
   - Brief description of what was done (issue #<number>)
   ```

6. **Docs update** — This step is mandatory. Do not skip it or the PR is not done.

   Run `/update-docs` to identify and update all impacted files. Then verify these specific items for every PR:

   **README.md** — If this issue adds a server, agent, or wires `callLLM` into a server, update the relevant table row. The table must never claim ✅ for a server that doesn't pass its anti-stub test.

   **`ARCHITECTURE.md`** — If this issue changes the topology (new package, new dependency direction, new transport), update the relevant section.

   **Per-package docs** — Each server/agent has its own `README.md`, `docs/ARCHITECTURE.md`, and `docs/DEPLOYMENT.md`. If you changed the package, update its docs.

   **`CHANGELOG.md`** (root + per-package) — Verify the entry exists under `[Unreleased]`.

   Every doc update must be written so a 12-year-old with no oil & gas background can follow it. Define terms, explain the why, make steps explicit.

7. **Commit** — Stage and commit any remaining changes:

   ```bash
   git add -A && git commit -m "..."
   ```

   Follow conventional commit format. Include `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.

8. **Push** — `git push -u origin <current-branch>`

9. **Open PR** — ALWAYS target `develop`. NEVER target `main`. This is a hard rule — no exceptions.

   Before creating the PR, confirm the base branch:
   ```bash
   git remote show origin | grep "HEAD branch"
   ```

   Create the PR:
   ```bash
   gh pr create --base develop --title "..." --body "..."
   ```

   ⚠️ If `gh pr create` is called without `--base develop`, it will use the repo default branch (which may be `main`). Always pass `--base develop` explicitly.

   ⚠️ If a `develop → main` PR (release PR) shows merge conflicts and GitHub's web editor is unavailable, run `/sync-main` to resolve them via CLI. Develop always wins on every conflict.

   PR body should include: Summary bullets, Test plan checklist, closes #<issue-number>.

10. **Close issue** — The PR closing via `closes #<number>` in the body handles this automatically when merged. Confirm the PR URL.

11. **Compact context** — After confirming the PR URL, run `/compact <focused instructions for next phase>` to reset context.

Report the PR URL when done.
