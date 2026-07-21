# Issue 596 Geologist ADK Retrospective

Date: 2026-07-21

## Scope

This note revisits completed issues #580, #587, and #589 after the stricter spec-driven development, definition of done, and refactor/deletion guidance was added.

## Findings

- #580 completed a useful open-issue normalization pass, but it predates the stricter prompt-eval, judge-strategy, HITL, and deletion-audit requirements now tracked by #596.
- #587 correctly made `agents/geologist` the package-local ADK project and kept `servers/geowiz` independent.
- #587 classified `agents/geologist/src/agent` as a temporary adapter, but did not force a package-local ADK eval harness.
- #589 moved the first real Geowiz MCP execution path into Python ADK code for `assess_quality`.
- #589 required a displaced-code table and adapter deletion path, but merged PR #590 did not include the table in the PR body.
- The retained TypeScript adapter remains valid only as a temporary path for callers and tools not yet migrated to ADK.

## Remediation In This Branch

- Added a package-local ADK eval harness under `agents/geologist/tests/eval/`.
- Added control, edge, and capability-boundary eval cases.
- Added deterministic eval checks for hard rules and an LLM judge only for subjective final-response quality.
- Added a CI-compatible shape test so the eval harness cannot disappear silently.
- Clarified the TypeScript adapter deletion path in the Geologist package spec and architecture docs.
- Created #597 as the named deletion follow-up for the retained Geologist TypeScript adapter.
- Fixed `App(root_agent=root_agent, name="app")` so the ADK app name matches the `app` directory for eval/session compatibility.

## Remaining Follow-Up

Do not migrate the rest of the fleet from #587/#589 directly. Each follow-up slice should use the Implementation Spec template and name:

- the exact Geologist tool or caller being moved
- the ADK-owned replacement path
- package-local eval coverage
- HITL/judge/memory/trust boundaries
- displaced files/tests/docs to delete
- any temporary adapter that remains and its deletion issue
