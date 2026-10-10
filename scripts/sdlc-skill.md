---
name: sdlc
description: Deliver ShaleYeah issues sequentially through develop. Use when starting, resuming or completing issue implementation, including branch and PR work.
---

Read `docs/sdlc.md` for the shared delivery contract and recovery instructions.
Run commands from the repository root. Use `pnpm sdlc status` before work.

1. Confirm the open issue and its approved acceptance criteria. Run `pnpm sdlc start <issue> <slug>` before changes. An active issue or pending implementation PR blocks the next issue; do not create parallel issue branches or bypass hooks.
2. Write failing tests, implement that one issue, delete displaced code, update affected docs and CHANGELOG, and run the appropriate verification and review gates.
3. Push the active branch and open one PR targeting `develop`. Include `Fixes #<issue>` and `SDLC-Base: <active.baseSha>` from status. Verify checks and review before merging through GitHub. An open PR does not complete an issue.
4. After the PR merges and its merge CI passes, verify the issue acceptance criteria and run `pnpm sdlc complete <pr>`. This closes the issue, updates develop and releases the slot. Only then start the next issue from the updated develop.

Existing authorization applies. Stop on failing gates and preserve work; never reset, force push, change receipts by hand or skip checks to advance. The command does not merge or release automatically. A reopened issue uses a new branch slug and repeats the same sequence.
