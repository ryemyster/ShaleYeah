# sync-main

Two modes:

1. **`/sync-main`** — fix a `develop → main` PR that GitHub is blocking due to conflicts
2. **`/sync-main post-merge`** — keep develop in sync after a `develop → main` merge completes (run this after every release merge to prevent the next conflict from accumulating)

**develop is always the source of truth. Develop wins on every conflict.**

---

## Mode 1: Fix a conflicted develop → main PR

Run this whenever a `develop → main` PR shows "This branch has conflicts that must be resolved."

### Steps

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

   GitHub may warn about branch protection rules. This is expected — the push goes through anyway.

4. **Verify the PR is now mergeable:**

   ```bash
   gh pr view <PR-number> --json mergeable,mergeStateStatus
   ```

   Expected: `MERGEABLE / BLOCKED` (blocked on CI only — that's fine).

5. **Wait for CI to pass**, then merge via GitHub UI.

---

## Mode 2: Post-merge develop ← main sync (run after every release)

After the `develop → main` PR merges, immediately sync develop so it includes the merge commit. This prevents the next develop → main PR from inheriting the divergence.

```bash
git fetch origin
git checkout develop
git pull origin develop
git merge origin/main --ff-only || git merge origin/main -m "chore: sync develop with main post-release"
git push origin develop
```

If `--ff-only` succeeds: develop and main are identical — no new commit needed.
If it falls back to a merge commit: push it anyway — the bases are now synced.

---

## Prevention — why conflicts recur

The three files that always conflict (`CHANGELOG.md`, `package.json`, `src/kernel/types.ts`) accumulate divergence with every PR to develop. The fix is cadence:

- Run **Mode 2** immediately after every `develop → main` merge
- Open a `develop → main` PR after every 3–5 feature PRs (not once per quarter)
- New test files auto-discovered via `scripts/run-tests.sh` — no more `package.json` edits per test suite
