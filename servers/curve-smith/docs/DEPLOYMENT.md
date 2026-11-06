# Packaging and deployment

The server builds independently and packs its declared runtime, examples and
license. `scripts/check-extraction.mjs` installs declared dependency archives and
employee/helper wheels outside the checkout, verifies independent source and
installed production operation, and records artifact/lock hashes. The checker
must pass before its bundle is used for container qualification.

The tool Dockerfile builds from that bundle and carries an installed evaluation
verifier without the employee app. The employee has a separate image. Neither
image embeds operator data or secrets. The container checker uses non-root
execution, actor-specific mounts, current grants and the protected native
review/restart/replay/revocation journey. Receipts identify exact image/base
hashes and architecture; a Dockerfile alone is not deployment evidence.

Local stdio uses `node dist/index.js`. Protected HTTP uses
`examples/local-http.mjs` with explicit access, event and source/review settings.
The production host owns current identity, source rights, retention, durable
private storage, qualification and human enrollment. Cloud hosts and live vendor
feeds require their own evidence; none is provisioned by this package.
