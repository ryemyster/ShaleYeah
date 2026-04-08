# new-issue-branch

Create a properly-named feature branch off `develop` for a GitHub issue.

## Usage

`/new-issue-branch <issue-number> <short-slug>`

Example: `/new-issue-branch 112 server-health-check`

## Steps

1. **Fetch issue details from GitHub**:

   ```bash
   gh issue view <issue-number> --json title,body,labels,assignees
   ```

   Read the title, acceptance criteria, and TDD checklist from the issue body. If the issue does not exist, stop and report the error.

2. **Derive slug** — If no slug is provided, derive one from the issue title: lowercase, hyphenated, max 4 words. Report the derived slug.

3. Fetch latest remote state: `git fetch origin`

4. Switch to develop and pull: `git checkout develop && git pull origin develop`

5. Create the branch: `git checkout -b feat/<issue-number>-<short-slug>`

6. Confirm the branch is tracking correctly: `git status`

Report the new branch name and a one-line summary of the issue's acceptance criteria when done.
