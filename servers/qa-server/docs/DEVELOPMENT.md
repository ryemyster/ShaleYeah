# Development

Work from an approved GitHub issue on a branch created from `develop`; use the
shared [sequential delivery workflow](../../../docs/sdlc.md). Write a failing
behavior or boundary test first, implement the smallest owning-package change,
remove displaced code, and update affected docs/changelogs before its PR.

Profiles are data, not executable plugins. Reuse the explicit allowlisted rule
schema. Profile revisions and approval hashes must bind the actual parsed
configuration. Keep pure rule evaluation separate from authenticated source
resolution and immutable artifact storage. Source parsers belong with their
owning data adapter. Use canonical closed contracts without adding undeclared
fields. Keep unknowns and assumptions separate from measured observations.

Run build, type-check, lint, coverage, configured qualification and extraction
before shipping. CI also checks the installed Node 22 container. Preserve
meaningful source/policy failures and generic-client regressions. A new rule or
format needs a separately reviewed outcome with independently labeled good,
bad, unavailable and authority cases; documentation alone is not qualification.

The QA employee's role, context, review workflow and configurable employee evals
are covered by [its charter](../../../agents/quality-assurance/docs/ROLE.md) and
its own ADK package. This server exposes bounded tools that package can consume.
