# sync-main

Resolve conflicts on an open `develop → main` PR when GitHub refuses to merge due to conflicts and the web editor is unavailable.

## Usage

`/sync-main`

Run this whenever a `develop → main` PR (e.g. #262, #268) shows "This branch has conflicts that must be resolved."

**develop is always the source of truth. Develop wins on every conflict.**

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

This is a pre-release step, not a per-PR step. The correct cadence is:

- Feature branches → `develop` (many per day, all day)
- `develop` → `main` (once per milestone/release, after running `/sync-main` to clear conflicts)

Run `/sync-main` once before cutting a release PR, and the `develop → main` merge will be clean. There is no need to run it after every feature PR.
