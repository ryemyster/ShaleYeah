# finish-issue

Complete and ship a finished issue: run pre-commit checks, update the changelog, push the branch, open a PR to `develop`, and close the issue.

## Usage

`/finish-issue <issue-number>`

## Steps

1. **Pre-commit checks** — Run `/pre-commit`. Stop if anything fails.

2. **CHANGELOG.md** — Add an entry under `[Unreleased]` describing the change. Use the format:
   ```
   ### Added / Fixed / Changed
   - Brief description of what was done (issue #<number>)
   ```

3. **Commit** — Stage and commit any remaining changes:
   ```bash
   git add -A && git commit -m "..."
   ```
   Follow conventional commit format. Include `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.

4. **Push** — `git push -u origin <current-branch>`

5. **Open PR** — Create a PR targeting `develop` (NOT `main`):
   ```bash
   gh pr create --base develop --title "..." --body "..."
   ```
   PR body should include: Summary bullets, Test plan checklist, closes #<issue-number>.

6. **Close issue** — The PR closing via `closes #<number>` in the body handles this automatically when merged. Confirm the PR URL.

Report the PR URL when done.
