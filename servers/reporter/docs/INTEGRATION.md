# Integrating Reporter tools

A compatible MCP client discovers and calls reference-based tools. Pass exact
source IDs and the configured requirements to `draft_report`. The result includes
canonical private work, Markdown, source revisions and disclosure requirements.
No tool accepts filesystem output paths or caller-supplied authority receipts.

Pin MCP 2026-07-28 for the shared SDK 0.3.0 transport. Every HTTP request is
self-contained and authenticated; initialization and transport session IDs are
rejected. Private work and human-review handles persist independently of the
connection. Discover the current tool schemas before calling them.

Trusted hosts configure `ReviewedSources.current` to authenticate origin review
and current recipient read/export rights. The service validates exact work, task,
request and decision bindings. Local owner-only exports provide an explicitly
operator-attested alternative; they do not prove a remote signature or professional
correctness. Business artifacts remain separate from raw connector profiles.

The `get_context_source_metadata` query returns permitted evidence metadata for
native context selection. Business-work metadata follows current sharing rights.
Original evidence needs its own exact current grant through
`ReviewedSources.currentMetadata`; local configuration uses
`contextMetadataGrants`. This does not grant raw-file access. Shared context must
match the current upstream origin/review/usage/retention references and the exact
private report artifact. Foreign evidence or a changed receipt blocks review.

Submit the exact work/context/evaluation/publication snapshot to `prepare_review`.
The human owner uses the separate enrolled review interface to inspect, request
changes, reject or approve that packet. `get_review_status` supplies a durable
checkpoint; `release_report` commits its exact grant to private reviewed reports
once. Source, task, template or qualification changes block continuation.
