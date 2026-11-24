# Title inputs and private binding

Title works from three operator exports, each with `version: "0.1.0"`. Preserve the exact bytes and hash each export separately. The exported schemas and parser in `src/title-packet.ts` define the accepted shapes; the synthetic `tests/fixtures/source-oracles.json` illustrates every field without representing a real tract.

| Export | Required content |
| --- | --- |
| Examination | `examinationRef`, exact `tractRef` and jurisdiction, examination `asOfDate`, party registry, half-open depth bands, required instrument revisions and questions |
| Corpus | `corpusRef`, instruments with recording identity, tract/jurisdiction, effective/recorded dates, explicit sequence/predecessors, original sections and normalized opening, transfer, burden and lease facts |
| Policy | `policyRef`, NRI requests with exact required burden revisions and supplied-schedule coverage, required lease revisions and declared conflicts |

Every normalized fact names its original section. Interest kinds are `record-title` and `operating-rights`. Shares are bounded non-negative rational strings (`1/2`, `0/1`), never floats. Transfers declare `fraction-of-grantor` or `fraction-of-whole`; burdens declare `working-interest` or `whole`. A null basis is unknown. Required missing burdens cannot become zero. Depth uses explicit `ft` or `m`; no implicit conversion or partial-band allocation is performed.

The current method requires complete supplied opening balances for each interest kind and examination band. An omitted share leaves an unknown holder and blocks completion. The method uses declared sequence/predecessors, not inferred legal priority. Duplicate identities/recordings, future or wrong-tract instruments, unknown parties, over-conveyance, conflicting claims, incomplete coverage and unknown post-term holding status cannot establish a ready packet. Primary-term dates are supplied facts, not legal expiry decisions.

## Operator configuration

`loadTitleBinding` reads `TITLE_CONFIG_FILE` and the three source files as owner-only regular files (0600). It rejects symlinks, changed bytes, wrong UID/enrollment, expired/revoked grants and configured credential content. State directories must be private. Keep sources, credentials, state and audit files outside a shared checkout.

The binding contains:

- `version`, `qualification` and `sourceAuthority: "operator-attested-export"`.
- A private `directory`, required `auditFile`, and run/trace `correlation`.
- A shared `task` assignment with customer/asset/task/employee scope and exact input artifacts; `examinationSourceRef`, `corpusSourceRef` and `policySourceRef` select those revisions.
- Three `sources` entries with an absolute `file` and validated source-artifact metadata: SHA-256, byte length, retrieval/evidence times, usage policy, scope and task revision.
- `sourceGrant` with subject, source IDs, expiry and revocation, plus explicit `sourceOperations` (`read`, `export`) and `maxSourceAgeSeconds`.
- `localOperator` UID/subject enrollment and private `sensitiveFiles` for secret scanning.
- Optional `review` containing the exact shared review policy, separate `localReviewer` enrollment and an installed `qualificationConfigFile`.

The review policy uses operation `record_title_packet`, destination `private-title-packets`, Title read/review/record scopes and all three mandatory gates: no blockers, evidence present, evaluation present. Approval without an installed current verifier fails. Current bytes and authority are checked across asynchronous work; unchanged metadata does not authorize changed file content.

The normalized public-download/internal-API snapshot hook accepts this same explicit JSON contract with current scopes, credential resolution, freshness and audit. No vendor-native or paid-source mapping is verified. Retrieval time is distinct from the examination and instrument dates.
