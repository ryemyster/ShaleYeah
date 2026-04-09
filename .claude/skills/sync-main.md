# sync-main

Resolve conflicts on an open `develop → main` PR when GitHub refuses to merge due to conflicts and the web editor is unavailable.

## Usage

`/sync-main`

Run this whenever a `develop → main` PR (e.g. #262, #268) shows "This branch has conflicts that must be resolved."

## Why this keeps happening

`develop` is the source of truth. Every feature PR merges into `develop`. The `develop → main` PR is a periodic release merge. When `develop` moves ahead of `main` between releases, the PR accumulates conflicts in CHANGELOG.md, README.md, docs/, and package.json. GitHub's web editor can't resolve these reliably, so we do it via CLI.

The resolution is always the same: **develop wins on every conflict**.

## Steps

1. **Ensure you are on develop and it is current:**

   ```bash
   git fetch origin
   git checkout develop
   git pull origin develop
   ```

2. **Merge main into develop, taking develop's side on all conflicts:**

   ```bash
   git merge origin/main --strategy-option ours -m "chore: merge main into develop — resolve conflicts (develop wins all)"
   ```

3. **Push develop:**

   ```bash
   git push origin develop
   ```

   GitHub will warn about branch protection rule violations (merge commits, direct push). This is expected — the push goes through anyway.

4. **Verify the PR is now mergeable:**

   ```bash
   gh pr view <PR-number> --json mergeable,mergeStateStatus
   ```

   Expected: `MERGEABLE / BLOCKED` (blocked only on CI — that's fine).

5. **Wait for CI to pass**, then the PR is ready to merge via GitHub UI.

## Prevention

To reduce how often this is needed, merge `develop → main` promptly after each milestone completes rather than letting `develop` accumulate many commits ahead of `main`. The longer the gap, the more conflicts accumulate.
