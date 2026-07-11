# Spec-Driven SDLC

This project uses a spec-driven workflow.

## Step 1. Spec

Write the issue as behavior, not as vague intent.

- Start with clear understanding:
  - what the issue is
  - what problem it solves
  - what it is not
- State the definition of done before any implementation work starts.
- Use `Given / When / Then` where possible.
- State the role and business purpose.
- State the operating mode.
- State the inputs and outputs.
- State the HITL boundary.
- State memory, eval, runtime, and portability expectations.
- State non-goals.

## Step 2. Architecture Decision

Before implementation, decide:

- stand-alone, hierarchical, graph-based, ambient, or capability-first
- what MCP boundary exists
- what is shared versus private
- what is deleted versus retained

## Step 3. Plan

Create the smallest executable plan that can be built and verified in isolation.

The plan must explicitly restate the definition of done in concrete terms:

- required tests
- required docs updates
- security review expectations
- deletion of displaced code
- dependency or rollout constraints

## Step 4. Build

- Implement the block.
- Delete displaced code.
- Do not merge old and new paths unless the issue explicitly requires a temporary adapter.

## Step 5. Verify

- Run the package-level tests.
- Add or update docs.
- Confirm the unit still works in isolation.

## Step 6. Close

Close the issue only when the spec is satisfied and the old path is removed or explicitly justified.
