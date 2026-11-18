# Assigned market scenarios and human review

The operator supplies an owned 0600 `MARKET_CONFIG_FILE` and private source files.
The file binds one task and principal to a market mandate, dated price series and
commercial assumptions. These are local operator-attested exports. Public API or
internal/licensed snapshots can use `createMarketSnapshotHook` with host-only
credential resolution, exact hashes, current read/export rights and required
audit. Offline API fixtures supply no verified paid-vendor entitlement.

## Binding and source contracts

The binding's closed schema lives in `src/configuration.ts` and uses:

| Field | Purpose |
| --- | --- |
| `version`, `sourceAuthority`, `qualification` | `0.1.0`, `operator-attested-export`, and explicit fixture/live status |
| `task` | Common TaskAssignment with customer/asset/task/employee scope, revision and exact input artifacts |
| `mandateSourceRef`, `seriesSourceRef`, `assumptionsSourceRef` | Exact bound input IDs/revisions |
| `sources` | Three absolute private files and complete common SourceArtifacts, including byte length/hash, scope, dates and rights metadata |
| `sourceGrant`, `sourceOperations`, `localOperator` | Current subject, allowed source IDs/operations, expiry, revocation and enrolled local UID |
| `directory`, `auditFile`, `correlation` | Owned 0700 storage, required redacted JSONL audit and run/trace identifiers |
| `sensitiveFiles`, `maxSourceAgeSeconds` | Secret-file references for content scanning and the source metadata age limit |
| `modelConfigFile` | Optional owned private reference model configuration for advisory synthesis |
| `review` | Optional exact review policy, separate local reviewer enrollment and installed `qualificationConfigFile` |

The mandate declares commodity, region, analysis as-of, daily/monthly frequency,
required periods, benchmark/realized series IDs, target unit, required scenarios
and observation/conversion age limits. Each series preserves source URI, native
unit/location, spot-benchmark/realized basis, observation periods, retrieval time,
publication vintage and optional applicable heat content. Future assumptions
supply explicit benchmark price, basis differential, period, unit, region and
rationale. The closed JSON shapes are in `src/market-scenario.ts`.

The service hashes actual private file bytes and rechecks current authority.
It does not fetch source URIs or execute source text. Missing periods are not
filled. A hub benchmark is not the operator's regional realized price. USD/Mcf
converts only with an applicable supplied MMBtu/Mcf factor. Future assumptions
remain operator scenarios, without commercial authority.

## Prepare, inspect and decide

The employee submits a proposed title, summary, evidence-series IDs, scenario IDs
and limitations. The backend calculates the canonical draft. Preparation verifies
it again against current sources and binds the host's exact context manifest,
evaluations and private `record_market_scenarios` action.

The operator uses the separate CLI, from this package or its installed archive:

```sh
MARKET_CONFIG_FILE=/absolute/private/market.json node examples/review.mjs inspect REVIEW_ID /absolute/private/NEW-packet.json
MARKET_CONFIG_FILE=/absolute/private/market.json node examples/review.mjs decide REVIEW_ID PACKET_DIGEST request_changes /absolute/private/reason.json
```

`reason.json` contains a bounded `reason` string. `reject` and `approve` use the
same command shape. Inspection creates a new private file without printing source
text. Review enrollment is separate from the employee subject and attests the
operator's commercial review role. A human can change assumptions by supplying new
source bytes/revisions, creating a revised draft and reviewing that revision.

Approval requires installed qualification, not a model-provided evaluation label.
Its private settings declare `schemaVersion: "0.1.0"`, absolute
`pythonExecutable`, `evidenceDirectory`, `policyFile`, exact deployed `codeRevision`
and passed `caseId`. The fixed SDK guard invokes the installed verifier with bounded
input/output; the employee cannot select another program or turn the gate off.
The trusted host generates current evidence from inspected source bytes and actual
employee output using the qualified Market evidence runner. Keep these files
outside employee write access and within original retention.

After approval, the employee supervisor reads current status and resumes the exact
bound operation once. Restart and replay return the same stored result. Changed
source/task/context, revoked rights, expired grant or changed qualification blocks
continuation. Native tool confirmation cannot supply a human grant. The private
record grants no trading, contract, bid, capital or professional certification
authority. Final named human MVP acceptance remains separate from technical
qualification and operator enrollment.
