# Connecting Reporter

Use the installed `shaleyeah-mcp-client` and a configured compatible endpoint.
`ReporterTools` holds the endpoint and credential outside model arguments. A
service exposes reviewed-source reads, source-linked drafting, exact review
preparation/status and protected private release. It may expose independently
configured synthesis discovery and unreviewed cited notes.

A trusted host opens `ReporterRuntime` with a current task/context authority,
source-evidence authority and optional authenticated origin-review authority.
Store reviewed shared work with `ContextCatalog.put_shared`, private work with
`put_work`, and pending review references with `checkpoint`. Every recovery checks
current rights and expiry. A configured native runtime never reuses another
employee's conversation or silently promotes a declared approval.

`ReviewSupervisor` polls the executing backend and resumes only its exact bound
`release_report` operation. The enrolled human uses the backend's separate review
API; neither a model message nor the employee MCP credential can decide reviews.
