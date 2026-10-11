# Configure permitted Geowiz inputs

Model access and source access are separate. A provider key does not grant a
file read. Geowiz now requires a private source binding for file-based MCP
(Model Context Protocol) calls. The binding identifies one employee's current
customer, asset, task/revision and read-only data grant. HTTP uses the authenticated
ingress principal; stdio uses the private local operator identity. Source text
cannot change either identity or approve an action.

## Prepare the operator configuration

After building contracts, connectors, SDK and Geowiz, copy
[local-source-config.json](../examples/local-source-config.json) to your private
0700 configuration directory as `sources.json`, with mode 0600. The template's
dates, root and hash are placeholders and will not fetch a real file.

Before enabling it, set:

1. The actual customer/employee owner and customer/asset/task/revision. Match the
   grant's subject ID to your HTTP policy principal, or the local stdio operator.
2. A canonical absolute workspace root owned by the executing user. Its
   directories must not be writable by other users. Set a relative source
   locator beneath it; no `..`, absolute locator or symlink is accepted.
3. The source ID, revision, credential-free logical URI, exact SHA-256 hash and
   accurate as-of time. Do not substitute retrieval time or file modification
   time for the source's age. Compute the hash from the file you reviewed.
4. Actual jurisdiction, access classification, permitted usage-policy version,
   license/access notes and expected LAS curve units. CSV field units must be
   explicitly operator-declared. The operator is responsible for these assertions.
5. Allowed source IDs/operations/scopes, grant expiry and freshness/byte/time
   limits. Both the manifest and grant must permit the request. The runtime
   refreshes the grant before reads and result publication. Source descriptors
   stay fixed for that binding; changed sources/configuration revisions require
   an explicit new binding/restart rather than silently updating a cached input.

For HTTP, add `"sourceConfigFile": "/absolute/private/sources.json"` to the
private access JSON and `source:read` to the granted principal's scopes. Existing
per-tool ingress grants still apply. The launcher uses its existing private
audit file for both ingress and distinct source-access events. Missing/failed
audit prevents execution. Start with the [HTTP setup](HTTP_ACCESS.md).

For local stdio, set both `GEOWIZ_SOURCE_CONFIG_FILE` and
`GEOWIZ_SOURCE_AUDIT_FILE` to private absolute paths, alongside the optional
`GEOWIZ_MODEL_CONFIG_FILE` for synthesis. The source audit file is an owned
regular 0600 append-only log; credentials are resolved independently. Missing
source configuration denies file tools; source config without an audit path
fails startup. Never put file contents or secrets into a prompt to grant access.

Remote/multi-operator hosts inject `sourceRuntime` with a trusted current-grant
service and audit hook. They need their own identity, policy, egress and
deployment qualification. The example supplies only a local private-file adapter.

## Read, discover and review

`fetch_source` accepts a configured source ID and returns verified provenance
without private paths or bytes. `get_source_status` checks actual access, bytes,
revision, freshness and format; server `/health` alone does not prove any of them.
Analysis tools accept the configured source ID, exact relative locator or
canonical approved path. They parse a private snapshot of the verified bytes
and return `analysis.sourceArtifact`; legacy `fileInfo`/`fileMetadata` no longer
act as provenance at the MCP boundary.

The current implemented source transport is narrow LAS 2/unwrapped and CSV.
Geowiz's formation, well-log and LAS quality handlers consume LAS snapshots.
CSV can be fetched for independent consumers. Other Geowiz format handlers stay
registered and return `unsupported_capability` until their adapters are reviewed.
File-tool `outputPath` writes are disabled; saving a finding remains a separate
authorized operation with the employee's existing confirmation boundary.

These controls prove source access and byte identity. Fixed quality metrics,
missing-input geology estimates and full professional LAS interpretation still
require #671. Read access does not approve a finding, reserve certification or
investment action; authenticated exact-revision review remains #673.

## Verify without external keys

From `servers/geowiz`, after building its dependencies:

```sh
pnpm test
pnpm exec tsx --test --experimental-test-coverage '--test-coverage-include=src/source-*.ts' --test-coverage-lines=90 tests/source-*.test.ts tests/model-provider-boundary.test.ts
```

The controls exercise actual protected MCP calls, permitted LAS provenance,
unconfigured/unapproved paths, changed bytes, revoked grants, audit failure,
disabled writes and private configuration. The connector package also tests
CSV and a fake internal API against common fixtures. Offline native ADK journeys
preserve both provider paths and save confirmation; live-vendor access and
professional quality still need their own evidence.
