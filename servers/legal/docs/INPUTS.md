# Legal input contract

The version 0.1.0 source payloads are exact JSON exports. A separate version 0.2.0 source-artifact envelope binds each file's SHA-256, byte length, source identity/revision, customer/asset/task/employee scope, retrieval observation, usage policy and read/export rights. Native PDF parsing and paid vendor mappings need separate qualification.

## Three source payloads

1. **Matter:** `version`, exact `matterRef`, `jurisdictionId`, `territoryId`, `activityId`, ISO `asOfDate`, and requested `questions` with exact `questionRef`/`prompt`.
2. **Corpus:** `version` and `documents`. Each document has exact `documentRef`, `title`, `sourceKind` (`contract`, `primary-law`, `guidance`, `counsel-note`), `sourceUri` and `sections`. Each section supplies `sectionId`, actual `text`, explicit jurisdiction/territory/activity ID arrays, `effectiveFrom`, nullable `effectiveUntilExclusive` and `sourceStatus` (`operator-reviewed` or `unverified`). Provision-level metadata allows an exception within the same document to have a different scope.
3. **Checklist:** `version`, exact `policyRef`, the same requested question references, their `requiredDocumentRefs`, and declared `conflicts`. Each conflict has exact `conflictRef`, `questionRef` and two or more distinct provision references. A checklist describes coverage rather than a prefilled answer or executable legal rule.

IDs and revisions are exact canonical identifiers; two revisions of one document remain distinct. Date intervals are inclusive at the start and exclusive at the end. Unknown/unverified/out-of-scope provisions cannot justify affirmative requirements. There is no inferred jurisdiction hierarchy or legal-truth oracle. Full strict schemas live in `src/legal-memo.ts`; independently authored examples and source provenance live in `tests/fixtures/source-oracles.json`.

## Proposal and result

A proposal contains `version: "0.1.0"`, `title` and `issues`. Each issue has exact `issueRef`, `questionRef`, `kind` (`requirement`, `exception`, `question`, `conflict`), proposed `statement` and `citations`. Use quote lookup to obtain each citation's exact document/section, UTF-8 `startByte`/`endByte`, literal `quote` and `sha256`. Paging counts Unicode code points rather than bytes.

The backend derives canonical `work` and `legal`, including all applicability reasons, missing required questions/documents/eligible anchors and missing declared conflicts. Readiness means complete source-backed proposed work for review. It does not establish legal entailment, professional acceptance or clearance.

## Local private binding

`LEGAL_CONFIG_FILE` names a version 0.1.0 binding with `sourceAuthority: "operator-attested-export"`, `qualification`, private `directory`/`auditFile`, event `correlation`, a closed task-assignment contract, `matterSourceRef`/`corpusSourceRef`/`policySourceRef`, and exactly three `sources` entries (`file`, source-artifact `artifact`). Task inputs and all exact source references must agree.

The binding includes a current `sourceGrant` (`subjectId`, allowed `sourceIds`, `expiresAt`, `revoked`), `sourceOperations` (`read`, `export`), `localOperator` (`uid`, `subjectId`), `sensitiveFiles` and `maxSourceAgeSeconds`. Paths are absolute. Files are owner-only and symlinks are denied. The state directory and audit path are private; the audit file belongs directly inside that directory. Changing source bytes without a matching revision fails closed even if the binding file stays unchanged.

Optional `review` supplies the closed review `policy`, separately enrolled `localReviewer` (`uid`, `subjectId`) and an optional installed `qualificationConfigFile`. The policy binds the task/requester, reviewer IDs, `record_legal_memo`, `private-legal-memos`, expiry, grant lifetime, bounds, usage/context/retention policies and mandatory `no-blockers`, `evidence-present`, `eval-present` gates. Employee scopes are `legal:review`/`legal:record`; source work also needs `legal:read`/`source:read`. Human review needs `legal:human-review` and independent enrollment. See `src/configuration.ts` and [integration](INTEGRATION.md).
