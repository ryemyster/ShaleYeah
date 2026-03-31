# context

Compact the current conversation context after completing a phase of work. Use this between phases (1a, 1b, Issue A, Issue B, etc.) to keep context lean and focused on what comes next.

## Usage

`/context <focused instructions for next phase>`

Example: `/context next phase is Issue A — remove demo bypass in mcp-client.ts`

## Steps

1. **Summarize what was just completed** — Output a brief (3–5 bullet) summary of what was done in the phase that just finished: files changed, tests passing, PR/issue status.

2. **State the next phase clearly** — Restate the user's focused instructions for the next phase so they are the first thing in the new context window.

3. **Run `/compact <focused instructions>`** — Pass the next-phase instructions directly to `/compact` so they become the carry-forward context summary.

## Rules

- Always call this at the end of each phase before starting the next.
- The focused instructions should be specific: name the files, issue numbers, or behavior being changed next.
- Do not carry forward implementation details from the previous phase unless they are directly needed by the next phase.
