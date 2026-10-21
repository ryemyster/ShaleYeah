# Role data connectors

A connector retrieves a permitted source and records which bytes were used.
This package supplies a read-only operator-file adapter and the installed-adapter
interface for public downloads, internal APIs and licensed exports. An API is a
service's programmatic interface; some suppliers offer only export files.
Configuration selects an already reviewed adapter ID/version. It never downloads
plugins or treats a model's proposed URL, path or permission as authority.

The [source schema](../contracts/shaleyeah_contracts/schemas/data-connectors-0.1.0.schema.json)
defines manifest, request, artifact and health records. Their profile version is
0.1.0; contracts package 0.2.0 added explicit source validators while preserving
employee profile 0.1.0. Current archive extraction consumes contracts 0.3.0 with
those same wire profiles; the separate event profile adds no connector authority.
Private configuration contains the approved root, source
locators and credential references. Those fields do not leave in public records.

## Use and verify

From the repository root, install locked dependencies and build the two packages:

```sh
pnpm install --frozen-lockfile
pnpm --dir contracts build
pnpm --dir connectors build
pnpm --dir connectors test
pnpm --dir connectors lint
pnpm --dir connectors check:isolation
```

The last command packs and installs both packages in a temporary consumer and
checks file/API controls without an agent, coordinator, warehouse or model client.
The packages have not been published to a registry. Extraction needs the built
contracts archive, this archive and the pinned `csv-parse` dependency.

```typescript
import { createConnectorRuntime, operatorFileAdapter } from "@shaleyeah/connectors";

const sources = createConnectorRuntime(privateConfiguration, {
  installedAdapters: [operatorFileAdapter],
  currentGrant: () => policyService.currentSourceGrant(),
  audit: event => auditService.persist(event),
});
const request = sources.request(approvedSourceId);
const fetched = await sources.fetch(request, authenticatedPrincipal, cancellation);
await sources.withSnapshot(fetched, authenticatedPrincipal, file => parseApprovedFile(file), cancellation);
```

`policyService`, `auditService`, `authenticatedPrincipal` and the parser are the
host's trusted dependencies, not library defaults. A grant binds subject,
customer, asset, task/revision, employee, source IDs, operation, scopes, rights
policy and expiry. It is checked before credentials/transport and before data
publication. Revocation stops later access, including publication after parsing.
Audit failures also stop execution/publication. Events contain allowed IDs,
revisions, stages, times and the verified retrieved hash; no source text,
private path, credential or vendor error is logged.

## File and evidence rules

The default adapter requires a canonical absolute POSIX workspace root, owned
by the executing OS user, with directories that others cannot write. Protect
ancestor directories and source configuration using OS permissions. Configured
relative locators cannot traverse out of that root or follow symlinks. Reads
must be regular files and fit the configured byte/time limits. Unsupported
hosts supply a separately qualified adapter. A private 0700 snapshot directory
and 0400 file hold only the verified bytes while the parser runs; they are
removed afterward. Changed bytes/revisions, missing access, stale dates,
unsupported adapters, bad format shape or mismatched units produce failures.
Health performs the same checks rather than trusting cached readiness.

Verified bytes that violate their declared LAS/CSV shape return
`conflicting_evidence`. Correct the input or declaration; a network retry
cannot fix that format error. Unavailable transport remains a separate failure.

The artifact separates retrieval time from the source's declared/reported
as-of time. SHA-256 binds the actual bytes; logical source URI, revision,
jurisdiction, access class, usage policy, access/license notes and adapter/parser
versions travel with the artifact. This metadata supports later eval/context
consumers; it does not certify geology, legal rights or human approval.

CSV uses [`csv-parse`](https://csv.js.org/parse/) 7.0.3 with bounded records,
strict quotes/column counts and operator-declared field units. Values are not
coerced; zero stays zero. The narrow LAS (Log ASCII Standard) profile requires
version 2, unwrapped V/W/C/A sections, named curve units and numeric rows.
It also accepts the existing fixture's explicit curve-name row. This transport
profile is not a complete LAS standard validator or geological-quality judge.
LAS units come from the header; conflicting declarations fail.

## Other installed adapters

Implement `InstalledSourceAdapter.fetch` to return bytes, revision, as-of time
and whether those assertions were supplied by the source or operator. Accept
the abort signal and byte limit. The runtime verifies the configured hash and
metadata independently. Inject a private credential resolver when the adapter
requires one; do not return SDK/session objects or credentials in artifacts.
The fake internal API is an offline conformance test, not a deployed integration.
Vendor endpoints, pagination, permitted egress and credentials need their own
review and qualification before installing an adapter.

The [role evidence matrix](../docs/employee-role-matrix.md) names industry sources
by employee. The [EIA API](https://www.eia.gov/opendata/documentation.php) and
[Energistics standards](https://energistics.org/the-standards) inform future
adapters; neither is a mandatory service. Our design separates source identity,
retrieval and derivation following [W3C provenance concepts](https://www.w3.org/TR/prov-dm/),
and separates membership/rights/policy following the [OSDU policy boundary](https://osdu.pages.opengroup.org/platform/security-and-compliance/policy/).
These are design choices, not OSDU compatibility or live-vendor certifications.

Geowiz is the first consumer. See its [source setup](../servers/geowiz/docs/DATA_SOURCES.md).
Professional LAS/QC repair, durable context, protected human continuation and
reference deployment remain in their respective plan issues.

The implemented LAS/CSV adapters issue source profile `0.1.0` artifacts. The
separately selected JSON-source `0.2.0` metadata profile does not add JSON parsing
to these adapters or change their permitted formats.
