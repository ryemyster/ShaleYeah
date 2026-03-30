# new-issue-branch

Create a properly-named feature branch off `develop` for a GitHub issue.

## Usage

`/new-issue-branch <issue-number> <short-slug>`

Example: `/new-issue-branch 112 server-health-check`

## Steps

1. Fetch latest remote state: `git fetch origin`
2. Switch to develop and pull: `git checkout develop && git pull origin develop`
3. Create the branch: `git checkout -b <issue-number>-<short-slug>`
4. Confirm the branch is tracking correctly: `git status`

If no slug is provided, derive one from the issue title using lowercase-hyphenated words (max 4 words).

Report the new branch name when done.
