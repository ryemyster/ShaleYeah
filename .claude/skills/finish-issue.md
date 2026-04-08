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

2. **Ghost-Close Guard** — Before running pre-commit, verify implementation exists. For server issues:

   ```bash
   grep -r "callLLM" src/servers/<server>.ts
   ```

   For kernel issues, grep for the new exported function/type in the relevant source file. If grep returns nothing: STOP — the issue is not implemented. Do not close.

3. **Pre-commit checks** — Run `/pre-commit`. Stop if anything fails. This includes `npm run type-check` — fix any type errors before proceeding.

4. **CHANGELOG.md** — Add an entry under `[Unreleased]` describing the change. Use the format:

   ```
   ### Added / Fixed / Changed
   - Brief description of what was done (issue #<number>)
   ```

5. **Docs update** — This step is mandatory. Do not skip it or the PR is not done.

   Run `/update-docs` to identify and update all impacted files. Then additionally verify these specific items for every PR:

   **README.md agent table** — The `Claude?` column must reflect truth. If this issue wires `callLLM` into a server, change that server's row from the issue link to ✅. If a server's LLM wiring is reverted or found broken, change ✅ back to the issue link. The table must never claim ✅ for a server that doesn't pass its anti-stub test.

   **`docs/SERVERS.md`** — If this issue changes what a server does, how it falls back, or its LLM status, update that server's entry. The description must match the actual code, not the original design intent.

   **`docs/DEMO_VS_PRODUCTION.md` LLM Integration Status table** — Keep this in sync with the README agent table. Same rule: ✅ only if anti-stub test passes.

   **`docs/GLOSSARY.md`** — If this issue introduces a new oil & gas concept, engineering term, or architectural pattern that doesn't already have an entry, add one. Define what it is, why it matters, and which file handles it.

   Every doc update must be written so a 12-year-old with no oil & gas background can follow it. Define terms, explain the why, make steps explicit.

6. **Commit** — Stage and commit any remaining changes:

   ```bash
   git add -A && git commit -m "..."
   ```

   Follow conventional commit format. Include `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.

7. **Push** — `git push -u origin <current-branch>`

8. **Open PR** — Create a PR targeting `develop` (NOT `main`):

   ```bash
   gh pr create --base develop --title "..." --body "..."
   ```

   PR body should include: Summary bullets, Test plan checklist, closes #<issue-number>.

9. **Close issue** — The PR closing via `closes #<number>` in the body handles this automatically when merged. Confirm the PR URL.

10. **Compact context** — After confirming the PR URL, run `/compact <focused instructions for next phase>` to reset context.

Report the PR URL when done.

## Code Comment Standards

When writing or reviewing code as part of any issue, comments must be clear enough that a 12-year-old who has never seen this codebase can understand what is happening and why. Follow these rules:

**What to comment:**
- Anything that isn't obvious from reading the function name and variable names alone
- The "why" behind a decision (not just the "what")
- Any fallback or safety-net behavior
- Magic numbers or constants that would confuse a reader

**How to write comments:**

```typescript
// BAD: restates the code
const toc = depth > 10000 ? 5.8 : 4.5; // set toc based on depth

// GOOD: explains what this means and why it matters
// Deeper rock has had more time to cook organic material into oil,
// so we estimate a higher TOC (Total Organic Carbon) for deeper wells.
const toc = depth > 10000 ? 5.8 : 4.5;
```

```typescript
// BAD: no context
} catch (_err) {
  return fallback();
}

// GOOD: explains why we swallow the error
} catch (_err) {
  // If the LLM is unavailable (no API key, network down, etc.),
  // we fall back to a rule-based estimate so the server still returns
  // something useful instead of crashing.
  return fallback();
}
```

**Style rules:**
- Write in plain English. Avoid jargon unless you define it first.
- One sentence is better than zero. Three sentences are better than one vague one.
- Comments describe intent and behavior — not syntax.
- Do not add comments to code you did not change (don't pad existing files).
