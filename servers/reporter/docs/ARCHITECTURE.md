# Reporter service architecture

Reporter is the independently runnable tool boundary for source-linked drafting
and human publication review. The employee's primary mode is **Stand-alone Agent
with Progressive Disclosure (Skills)**; the service uses deterministic business
state rather than an agent reasoning loop.

`report-assembly.ts` preserves upstream values, units, basis and source revisions.
`reviewed-sources.ts` verifies exact task/work/review/sharing receipts through an
installed authority adapter. The reviewed-business-artifact interface is JSON;
it does not claim conformance with the separate LAS/CSV raw-data connector.

`review-workflow.ts` owns Reporter action, destination, scopes and candidate
schema while reusing the shared durable review machinery. Exact reassembly and
configured requirements reject altered numbers, missing disclosures or invented
publication prose. Owner edits require a new draft and review packet. Only the
authenticated human can approve. Qualification is required and cannot be waived
by a declared score. The store rechecks current rights before committing once.

`server.ts` registers bounded reference-based tools. `configuration.ts` provides
an owner-only local bootstrap; remote hosts inject their source, secret, audit
and HTTP identity services through the declared interfaces. Synthesis can add an
unreviewed cited note with an explicit model profile, never a publication grant.
