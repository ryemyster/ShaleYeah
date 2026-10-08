# Sequential issue delivery

One issue moves through implementation, verification, review and a PR into
`develop`. After that PR merges and its checks pass, synchronize `develop` and
start the next issue from the updated commit. Issue dependencies determine the
order. Do not create a batch of issue branches from an earlier develop snapshot.

## Setup for Codex, Antigravity and Claude Code

From the repository root, with Git, Node >=22, the root `packageManager` pnpm
version and authenticated `gh`. Use [Getting Started](GETTING_STARTED.md) for
locked workspace/package dependencies before installation:

```sh
pnpm sdlc install
pnpm sdlc status
```

The installer enables tracked `scripts/git-hooks/pre-commit` and `pre-push`
through this clone's `core.hooksPath`. It records and chains the previous hook
directory, including the maintainer's existing `.agents/hooks` quality checks.
It preserves existing local instructions and refuses to overwrite an unrelated
`sdlc` skill. Re-running the installer is safe.

The same short skill is installed at `.agents/skills/sdlc/SKILL.md` for Codex and
Antigravity, and `.claude/skills/sdlc/SKILL.md` for Claude Code. This clone's
`.claude -> .agents` symlink is supported. Reload a coding agent if it has cached
its skills. In Codex invoke `$sdlc`; in Antigravity or Claude Code invoke `/sdlc`,
or ask the agent to follow the SDLC skill. All three use the same CLI and Git
guards; their prompts do not implement separate delivery rules.

The adapter locations follow [Codex skills documentation](https://learn.chatgpt.com/docs/build-skills),
[Antigravity skills documentation](https://www.antigravity.google/docs/skills/),
and [Claude Code skills documentation](https://code.claude.com/docs/en/skills).
Personal runtime files stay ignored. Shared policy and implementation stay in
tracked `CONTRIBUTING.md`, this document and `scripts/`.

## Deliver one issue

1. Verify that the GitHub issue is open, its plan is approved and its dependencies
   have completed. Start it before implementation:

   ```sh
   pnpm sdlc start 664 mvp-delivery-plan
   ```

   Start checks for an active issue and other open implementation PRs, fetches
   `origin/develop`, safely fast-forwards local `develop`, and creates
   `issue-664-mvp-delivery-plan` at that exact SHA. It requires clean tracked
   files; untracked files are retained and Git refuses any checkout that would
   overwrite them. It never resets or force pushes. Branch name collisions stop
   the command before it switches branches.

2. Write failing tests, implement only the issue, remove displaced code, update
   affected docs and the changelog, and perform code review and the required
   package-local verification. Shared workspace or CI changes also require root
   workspace checks. These quality gates still apply independently of delivery
   ordering.

3. Commit and push the active issue branch. Open one PR with base `develop`,
   `Fixes #664`, and this standalone line using `active.baseSha` from status:

   ```text
   SDLC-Base: <40-character develop SHA recorded at start>
   ```

   Wait for green checks and complete review before merging through GitHub.
   Do not mark the issue complete just because the PR is open.

4. After merging, wait for the push CI on the merged commit, verify the issue's
   acceptance criteria, then run:

   ```sh
   pnpm sdlc complete <merged-pr-number>
   ```

   Complete verifies the exact issue branch head, PR base, merged state,
   fetched develop ancestry and all reported checks on the current PR. For the
   merged commit it requires successful push runs for `ci.yml`, `codeql.yml` and
   `gitleaks.yml`, and successful `PR checks` and other checks in those push suites.
   Other push workflows also must succeed. A different release PR or background
   dependency job sharing that SHA cannot change this delivery's result. The
   workflow file paths are defined in `MERGE_WORKFLOWS` in `scripts/sdlc.mjs`;
   update that list when renaming or replacing a required merge workflow.
   Completion fast-forwards develop, closes the issue
   with merge evidence, records completion and releases the active slot. Missing,
   failed or pending checks keep it locked. The next `start` fetches develop
   again and branches from its current SHA. The tool does not merge PRs or
   release to `main` automatically.

A reopened issue follows the same sequence with a new branch slug. Each
implementation attempt still completes before the next issue starts.

## Enforcement and limits

The GitHub account used for completion needs repository issue write access and
Actions read access. CI's PR-order check uses only its existing read permissions.

The common Git directory holds `sdlc/state.json` and an atomic operation lock.
Worktrees of this clone share one active issue. A stopped process may leave a
lock; inspect the owning operation before clearing an abandoned empty lock
directory. Completion history and active receipts contain issue numbers,
branches and commit IDs, with no credentials or employee memory.

Pre-commit rejects work outside the registered issue branch or after develop
changes. Pre-push additionally rejects other implementation PRs and pushes to
protected refs, different branch names, tags or deleted refs. Both fetch develop
and fail if the network cannot verify it. Existing quality hooks receive their
original arguments and, for pre-push, the original ref updates on standard input.
Git hooks run for ordinary Git operations from any coding tool.

The existing `PR checks` CI job runs the script tests and validates develop PRs:
one open implementation PR, a matching issue reference, a recorded current base,
and ancestry containing current develop. PR body edits rerun the gate. Existing
Dependabot proposals are excluded from the active implementation PR count;
schedule their merges between issues because any develop merge invalidates an
active issue's base. Dependabot PRs still need a current develop ancestor.

Local hooks can be disabled by a user, and separate clones do not share the local
receipt before a PR is opened. GitHub branch protection should require `PR checks`
and an up-to-date branch to enforce the CI gate at merge time. Installation does
not change repository protection settings. The gate cannot prove that an agent
understood the issue, verified acceptance correctly or performed useful review.

## Resume and recovery

- Use `pnpm sdlc status` to resume the active issue. Do not start another branch
  while its receipt is active.
- For pending merge CI or temporary network errors, fix the underlying condition
  and retry the same command. A failed completion retains the receipt even if
  develop was already synchronized; issue closure is safe to retry.
- If develop advances during implementation, stop and reconcile with the
  maintainer. Preserve the branch, commits, receipt and any PR. Review the
  intervening merge, update the current issue's code/tests and base deliberately,
  and rerun verification. Receipt repair is a maintainer recovery operation,
  never a way to skip an unfinished issue or silently start another one.
- If local develop contains unmerged commits or another worktree has it checked
  out, resolve that explicitly. The command will not discard work or displace
  another worktree.
- For initial installation only, `start <issue> <slug> --adopt` registers an
  existing matching issue branch at current develop before its first commit.
  It still verifies the open issue and absence of other implementation PRs.
- Keep installed hooks synchronized with tracked scripts. To intentionally
  uninstall, restore `core.hooksPath` to `sdlc.previousHooksPath`; preserve any
  active receipt until the issue has been reconciled.

Run the deterministic regression suite with `pnpm test:sdlc`. It uses temporary
repositories, local bare remotes and GitHub fixtures; no API key is required.
