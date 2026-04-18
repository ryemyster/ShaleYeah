# new-issue-branch

Create a properly-named feature branch off `develop` for a GitHub issue.

**SDLC order is mandatory: issue must exist on GitHub BEFORE any code is written.**

## Usage

`/new-issue-branch <issue-number> <short-slug>`

Example: `/new-issue-branch 112 server-health-check`

## Steps

1. **Verify the issue exists on GitHub** — this is a hard gate. Do not skip it.

   ```bash
   gh issue view <issue-number> --json number,title,state,body,labels
   ```

   - If the issue does not exist: **STOP. Do not create a branch. Do not write any code.** Tell the user to run `/create-issue` first.
   - If the issue is already CLOSED: **STOP** and ask the user whether they want to reopen it or create a new one.
   - Read the title, acceptance criteria, and TDD checklist from the issue body. Echo a one-line summary so the user can confirm you read the right issue.

2. **Derive slug** — If no slug is provided, derive one from the issue title: lowercase, hyphenated, max 4 words. Report the derived slug.

3. Fetch latest remote state:

   ```bash
   git fetch origin
   ```

4. Switch to develop and pull:

   ```bash
   git checkout develop && git pull origin develop
   ```

5. Create the branch (no `feat/` prefix — use bare `<issue-number>-<slug>`):

   ```bash
   git checkout -b <issue-number>-<short-slug>
   ```

6. Confirm the branch is tracking correctly:

   ```bash
   git status
   git branch --show-current
   ```

7. **Remind the user of the TDD order** before they write any code:

   > Branch ready. TDD order: write the failing test first → implement → run `/pre-commit` → `/finish-issue <issue-number>`.

Report the new branch name and the issue's acceptance criteria when done.

## Hard rules

- **Never create a branch without a confirmed GitHub issue number.** If the user says "let's work on X" without an issue number, run `/create-issue` first, get the number, then cut the branch.
- Never branch off `main`. Always branch off `develop`.
- Never start implementing before the branch is cut. The branch is the starting gun.
