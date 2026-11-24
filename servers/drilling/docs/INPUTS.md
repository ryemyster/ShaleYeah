# Drilling inputs and private binding

Measured depth (MD) follows the wellbore; true vertical depth (TVD) measures the vertical distance from a declared reference. A datum identifies that reference.

Three operator exports use `version: "0.1.0"`. Preserve and hash their exact bytes separately. The exported schemas/parser in `src/drilling-packet.ts` define the contract; `tests/fixtures/source-oracles.json` illustrates every field with synthetic data.

| Export | Required content |
| --- | --- |
| Design | Exact `designRef`, `wellRef`, `formationRef`, as-of date, target MD/TVD with units/datums, source basis, supplied options with casing/mud/completion references and ordered hole sections, required evidence revisions and questions |
| Corpus | Original evidence sections tied to the same well/design/formation and dates, normalized quoted cost lines, sequential schedule phases, offset applicability and hazard/mitigation review rows |
| Policy | Well/design identity, currency and explicit half-up-cents policy, required costs/phases by option, required offsets/hazards and declared conflicts |

Decimals are bounded non-negative strings with at most six fractional places. Targets are positive. MD/TVD are distinct; a missing TVD cannot be inferred from MD. Every depth declares `ft` (international foot exactly 0.3048 m) or `m` and the same explicit datum. Null units/datums and US survey feet remain exceptions. Sections must cover zero through supplied target MD in declared order; bottom TVD cannot exceed MD or decrease. These are consistency checks, not trajectory or casing design validation. Component references remain supplied claims.

Costs name quantity, unit, rate, per-unit, currency and an original quote section. Units/currency must agree; no FX or default rates are inferred. Exact line amounts and exact scope total remain rational strings, with cents rounded half up from the exact amount. Explicit zero is permitted; missing required lines leave the total unknown. This scope excludes any unquoted costs or contingencies. Schedule rows explicitly declare sequential order and decimal days; no concurrency, critical-path or drilling-speed calculation is inferred.

Hazards and offsets name exact source sections. Required hazard rows apply to every supplied option; unknown status/severity, unreviewed mitigation, absent identified-hazard mitigation references, missing offsets and unknown applicability block readiness. Reported severity is operator data, never a calibrated probability. Document identity, original text and byte citations do not verify semantic engineering conclusions. A qualified engineer assesses those conclusions.

## Private operator configuration

`loadDrillingBinding` reads `DRILLING_CONFIG_FILE` and source files as owner-only regular files (0600). It rejects symlinks, changed bytes, wrong enrollment, expired/revoked grants and configured credential content. State and audit directories must be private. Keep sources, credentials and state outside shared checkouts.

The binding contains `version`, `qualification`, `sourceAuthority: "operator-attested-export"`, a private absolute `directory`/`auditFile`, and run/trace `correlation`. Supply a shared task assignment with exact customer/asset/task/employee scope and three input artifacts; `designSourceRef`, `corpusSourceRef` and `policySourceRef` select their revisions. Each `sources` entry has an absolute file and validated source-artifact metadata including SHA-256, byte length, retrieval/evidence times, usage policy, scope and task revision.

`sourceGrant` declares the subject, source IDs, expiry and revocation. `sourceOperations` declares read/export rights. `maxSourceAgeSeconds` bounds observation age. `localOperator` binds UID/subject enrollment, and `sensitiveFiles` supplies private values for secret scanning. Optional `review` supplies the shared review policy, separate local reviewer enrollment and installed qualification configuration file. The synthetic `tests/fixtures/local-binding.ts` builds a complete example; it is not a production authority provider.

Review uses operation `record_drilling_packet`, destination `private-drilling-packets`, Drilling read/review/record scopes and all mandatory no-blockers/evidence/eval gates. Current bytes and authority are checked across asynchronous work. Normalized public-download/internal-API hooks accept the same explicit JSON with current credential/usage grants and audit. Native WITSML parsing and paid-vendor mappings are unsupported. Retrieval time differs from the source's engineering as-of date.
