# Coordinator workflow scope

There is no running coordinator in this stub. The planned pilot helps a human
owner assign a geological diligence task to Geologist and Research Analyst,
review their findings and prepare a decision within granted authority.

The bounded #676 workflow, after the #675 charter, must:

1. Receive an authenticated task with scope and permitted outcomes.
2. Delegate identified child tasks with bounded authority and context.
3. Receive source-linked work products and their review status.
4. Surface missing inputs, conflicts, failures or required human decisions.
5. Resume only the correct reviewed revision after interruption.
6. Return an evidenced result and correlated audit trail.

Each employee's human owner still reviews that employee's work. Coordination
does not expose all private employee memories or automatically approve actions.
The chosen adapter must prove persistence and recovery; this page does not
claim that the current stub resumes work.

See the [architecture decision](../../docs/adr/0001-durable-employee-contracts.md)
and [MVP acceptance plan](../../docs/mvp-release-plan.md).
