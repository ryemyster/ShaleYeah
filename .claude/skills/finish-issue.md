# finish-issue

Complete and ship a finished issue: run pre-commit checks, update the changelog, push the branch, open a PR to `develop`, and close the issue.

## Usage

`/finish-issue <issue-number>`

## Steps

1. **Fetch issue details from GitHub**:

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

   - Server issues: `grep -r "callLLM" src/servers/<server>.ts`
   - Kernel issues: `grep -r "<new-export>" src/kernel/<file>.ts`
   - Other: grep for the primary new symbol in the relevant source file

   If grep returns nothing: STOP — the issue is not implemented. Do not close.

4. **Pre-commit checks** — Run `/pre-commit`. Stop if anything fails. This includes `npm run type-check` — fix any type errors before proceeding.

5. **CHANGELOG.md** — Add an entry under `[Unreleased]` describing the change. Use the format:

   ```
   ### Added / Fixed / Changed
   - Brief description of what was done (issue #<number>)
   ```

6. **Docs update** — This step is mandatory. Do not skip it or the PR is not done.

   Run `/update-docs` to identify and update all impacted files. Then additionally verify these specific items for every PR:

   **`docs/ARCADE-PATTERNS.md`** — Check whether this issue implements or changes any Arcade pattern. If yes: update the pattern row status (✅ / 🔶 / ❌), update the `Implementation` column description, recompute the coverage summary table at the bottom, and update the `Last audited` date. If no pattern changed, leave the file untouched.

   **README.md agent table** — The `Claude?` column must reflect truth. If this issue wires `callLLM` into a server, change that server's row from the issue link to ✅. If a server's LLM wiring is reverted or found broken, change ✅ back to the issue link. The table must never claim ✅ for a server that doesn't pass its anti-stub test.

   **`docs/SERVERS.md`** — If this issue changes what a server does, how it falls back, or its LLM status, update that server's entry. The description must match the actual code, not the original design intent.

   **`docs/DEMO_VS_PRODUCTION.md` LLM Integration Status table** — Keep this in sync with the README agent table. Same rule: ✅ only if anti-stub test passes.

   **`docs/GLOSSARY.md`** — If this issue introduces a new oil & gas concept, engineering term, or architectural pattern that doesn't already have an entry, add one. Define what it is, why it matters, and which file handles it.

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
