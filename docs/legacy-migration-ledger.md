# Legacy migration ledger

This is the caller-backed keep, refactor and deletion plan for
[Issue #576](https://github.com/ryemyster/ShaleYeah/issues/576). It records the
tracked repository at develop `c1e3085d3d8830c6c2dfb4703960a3a1b38565a3`, inspected
on 2026-10-08. Recheck callers at each replacement PR; this snapshot is not
permission to remove a path still in use. This inventory PR changes documents,
not employee execution or tool algorithms.

Keep the monorepo and independently useful tools. Replace execution duplication
in the owning employee PR, then remove shared runtime code after its last
supported consumer migrates. Starting a blank repository would also discard
contracts, domain fixtures, tool boundaries and useful regression evidence.

ADK (Google's Agent Development Kit) is the primary Python employee framework.
MCP (Model Context Protocol) connects an employee to a separately runnable tool
server. Neither owns the durable business records in [contracts/](../contracts/README.md).
This issue uses **shared contract/process only** operating mode; it does not
change any role's primary mode or delegate professional decisions to a model.

## Decisions and expiry rules

| Decision | Meaning | Required evidence before delivery |
| --- | --- | --- |
| Keep | Independently useful business contract, tool or verified utility | Named callers, declared dependencies, package checks and honest support limits |
| Refactor | Useful behavior with a defective or coupled implementation | Failing behavior cases first; retain the useful behavior at its proper boundary |
| Adapter | Current compatibility path awaiting a named replacement | Direct caller, owning issue and expiry condition; no permanent second runtime |
| Delete after gate | Displaced path to remove in its replacement PR | Last supported caller migrated, replacement accepted, exports/tests/docs/commands removed together |

Numerical and parsing code below is a **retention candidate**, not certified
professional logic. Keep a calculation or format capability only within the
correctness/format envelope its tests and expert review establish. A shape test,
variable output or successful import does not establish that envelope. Defer
unsupported output instead of converting missing input into a plausible result.

Before implementation, the evidence checklist covered tracked paths; production,
test and public-export callers; workspace/CI (continuous integration) commands;
four legacy employees; ten Python wrappers; parser/calculation limits; source and
confidence fallbacks; cleanup guards; deletion owners and extraction gates.
Local file/import verification supplies the conclusions below. Context Engine
investigations returned partial evidence, including a narrower retry; failed
searches were not treated as proof of no consumers.

## Four remaining TypeScript employees

Each `src/agent/index.ts` contains role configuration, tool mappings, prompts and
a copied task loop. These files total **2,505 lines**: 656 Economist, 655 Reservoir
Engineer, 625 Reporter and 569 Quality Assurance. That is the size of the files,
not a claim that every line is duplicated or should disappear.

| Current path | Direct consumers/evidence | Decision and replacement owner |
| --- | --- | --- |
| [economist/src/agent/index.ts](../agents/economist/src/agent/index.ts), [econobot-client.ts](../agents/economist/src/agent/econobot-client.ts) | `src/index.ts`, package start script, `tests/agent.test.ts`, `tests/mcp-client.test.ts`; loop imports SDK runtime/context/poller/compensation/LLM | Adapter → delete in [#680](https://github.com/ryemyster/ShaleYeah/issues/680), after ADK employee/review/context/eval/tool acceptance; economics repair [#711](https://github.com/ryemyster/ShaleYeah/issues/711) first |
| [reservoir-engineer/src/agent/index.ts](../agents/reservoir-engineer/src/agent/index.ts), [curve-smith-client.ts](../agents/reservoir-engineer/src/agent/curve-smith-client.ts) | Same package entry/start/tests and SDK dependency pattern | Adapter → delete in [#681](https://github.com/ryemyster/ShaleYeah/issues/681); type-curve repair [#712](https://github.com/ryemyster/ShaleYeah/issues/712) first |
| [reporter-agent/src/agent/index.ts](../agents/reporter-agent/src/agent/index.ts), [reporter-client.ts](../agents/reporter-agent/src/agent/reporter-client.ts) | Same entry/start/tests; runtime and endpoint factory remain exported | Adapter → delete in [#541](https://github.com/ryemyster/ShaleYeah/issues/541); preserve source-faithful report assembly and human publication review |
| [quality-assurance/src/agent/index.ts](../agents/quality-assurance/src/agent/index.ts), [qa-server-client.ts](../agents/quality-assurance/src/agent/qa-server-client.ts) | Same entry/start/tests; runtime and endpoint factory remain exported | Adapter → delete in [#542](https://github.com/ryemyster/ShaleYeah/issues/542), using charter [#538](https://github.com/ryemyster/ShaleYeah/issues/538); preserve independent data-quality tools |

For **each of these four packages**, its owning PR must remove or replace
`src/index.ts`, `src/agent/`, `package.json`, `tsconfig.json`, `biome.json`, the
two TypeScript tests and pnpm/tsx/start/build references in its README and docs.
Remove generated `dist/` from delivered artifacts, obsolete prompts and obsolete
fixtures; retain useful role requirements as ADK assets and meaningful tests.
The package's own `README.md`, `CHANGELOG.md` and `docs/` must describe its new
install/run/check/review lifecycle. Do not delete the matching TypeScript MCP.
Update workspace lock entries as dependencies actually disappear.

The private TypeScript clients use MCP `Client` and Streamable HTTP, return
content blocks and race an external timeout. They are active compatibility
code, not evidence of full schema/error/cancellation conformance. Replace with
the installable Python client from [#679](https://github.com/ryemyster/ShaleYeah/issues/679)
and keep typed role tool mappings; remove displaced transport tests with the
client, carrying useful failure/cancellation cases into replacement tests.

## Python MCP adapters

All ten paths below are imported by their package's `app/agent.py`. Geologist
now uses the installed [Python client](../sdk/python/README.md); its thin adapter
keeps only role configuration, labels and nine tool mappings. Its copied protocol
and schema/result logic and old transport-text assertions were replaced in #679.
The other nine packages still read/use their local copies, which initialize
an MCP session per call and serialize content. Shared
protocol/session/error/auth/cancel handling belongs in an installable helper.
Role URL configuration, tool names, typed inputs and human-confirmation mapping
remain role-local. Consolidation does not erase those responsibilities.

| Current adapter path | Replacement/deletion owner | Expiry |
| --- | --- | --- |
| [geologist/app/geowiz_mcp.py](../agents/geologist/app/geowiz_mcp.py) | #679 replaced protocol plumbing with declared `shaleyeah-mcp-client==0.1.0`; retain useful role mappings | Client/Geologist wheels and actual protected Geowiz connection pass; full source/review journey remains #671/#673/#674 |
| [risk-analyst/app/risk_analysis_mcp.py](../agents/risk-analyst/app/risk_analysis_mcp.py) | [#682](https://github.com/ryemyster/ShaleYeah/issues/682) | Role adopts verified helper and deletes copied plumbing |
| [legal-analyst/app/legal_mcp.py](../agents/legal-analyst/app/legal_mcp.py) | [#683](https://github.com/ryemyster/ShaleYeah/issues/683) | Same, including human legal authority |
| [market-analyst/app/market_mcp.py](../agents/market-analyst/app/market_mcp.py) | [#684](https://github.com/ryemyster/ShaleYeah/issues/684) | Same, including source freshness/assumptions |
| [title-analyst/app/title_mcp.py](../agents/title-analyst/app/title_mcp.py) | [#685](https://github.com/ryemyster/ShaleYeah/issues/685) | Same, including title/source access boundaries |
| [drilling-engineer/app/drilling_mcp.py](../agents/drilling-engineer/app/drilling_mcp.py) | [#686](https://github.com/ryemyster/ShaleYeah/issues/686) | Same, including design approval |
| [development-planner/app/development_mcp.py](../agents/development-planner/app/development_mcp.py) | [#687](https://github.com/ryemyster/ShaleYeah/issues/687) | Same, including plan revision/review |
| [research-analyst/app/research_mcp.py](../agents/research-analyst/app/research_mcp.py) | [#688](https://github.com/ryemyster/ShaleYeah/issues/688) | Same, including citation/coverage boundaries |
| [infrastructure-planner/app/infrastructure_mcp.py](../agents/infrastructure-planner/app/infrastructure_mcp.py) | [#689](https://github.com/ryemyster/ShaleYeah/issues/689) | Same, including engineering/compliance approval |
| [investment-chair/app/decision_mcp.py](../agents/investment-chair/app/decision_mcp.py) | [#690](https://github.com/ryemyster/ShaleYeah/issues/690) | Same, including human capital authority |

The #576 inventory baseline counted **1,276 lines** in the ten files, including useful role mappings. Delete
duplicated protocol machinery after the owning role passes; a thin role adapter
may keep its filename if it only declares that role's mappings. The PR must
identify the exact retained and removed behavior. #679 is not a fleet migration.
It depends on session lifecycle [#668](https://github.com/ryemyster/ShaleYeah/issues/668),
schema/error preservation [#677](https://github.com/ryemyster/ShaleYeah/issues/677)
and authenticated MCP entry [#678](https://github.com/ryemyster/ShaleYeah/issues/678).

## SDK source and public exports

[sdk/src/index.ts](../sdk/src/index.ts) publicly re-exports the top-level modules
below. `sdk/package.json` is not private and points its public import/type entry
at that barrel. No internal production caller does **not** prove no external
consumer. [#692](https://github.com/ryemyster/ShaleYeah/issues/692) must record the
supported public API/version/deprecation disposition before removing exports;
unknown downstream use cannot be waved away by a repository search.

| Tracked path under `sdk/src/` | Observed caller or evidence | Decision / owner and gate |
| --- | --- | --- |
| [agent-loop.ts](../sdk/src/agent-loop.ts) | Barrel exports `runAgentTask`, `buildAgentTranscript`, `parseAgentJsonResponse`; `sdk/tests/agent-loop.test.ts` exercises loop/parser; no tracked production call found outside module | Delete after gate #692, after supported API disposition and equivalent replacement regression cases; it is not the four employees' copied loop implementation |
| [context-store.ts](../sdk/src/context-store.ts) | Four employee loops + shared loop + their tests; process-local map of appended strings | Adapter → delete #692 after durable scoped context [#672](https://github.com/ryemyster/ShaleYeah/issues/672) and role adoption; preserve reviewed-sharing/invalidation/export requirements |
| [runtime.ts](../sdk/src/runtime.ts) | Four runtime factories, shared loop types, identity tests; `redactSensitive` used internally and publicly exported | Adapter → delete displaced executor #692 only after backend authority/review/audit behavior is replaced; decide reusable redaction separately, retaining it only with callers/tests |
| [service.ts](../sdk/src/service.ts) | All four employee endpoint factories construct `LocalAgentEndpoint` | Adapter → delete #692 after those factories migrate; this facade is not a universal HTTP employee service |
| [async-job.ts](../sdk/src/async-job.ts) | Four loops + shared loop; bare JSON-RPC fetch poller and timing constants | Adapter → delete #692 after declared supported long-running tool behavior/cancellation is covered; do not mistake polling helpers for implemented server jobs |
| [compensation.ts](../sdk/src/compensation.ts) | Four loops + shared loop call registry; registration observed in tests, not production handler setup | Adapter → delete #692 after reviewed write/failure recovery is preserved at executing backend; remove unsupported rollback claims |
| [contracts.ts](../sdk/src/contracts.ts) | Four employee imports, runtime/service/loop; public legacy runtime/transport interfaces, distinct from `contracts/` business records | Adapter → retire displaced interfaces in #692 after last supported caller/public API disposition. Move any still-supported interfaces with declared compatibility; do not delete by filename alone |
| [errors.ts](../sdk/src/errors.ts) | Runtime, four private clients and `sdk/tests/errors.test.ts` | Refactor error boundary #677/#679; #692 deletes only obsolete runtime-specific exports after last caller and public disposition |
| [llm-client.ts](../sdk/src/llm-client.ts) | `callLLM` in 13 server packages and four TS employees; Geowiz uses configured native synthesis; LLM client tests | Temporary compatibility for unmigrated consumers; deletion owned by #692/#576. Geowiz uses `model-provider.ts`; other units need their own provider conformance |
| [mcp-server.ts](../sdk/src/mcp-server.ts) | `ServerFactory` constructs base used by all 14 MCPs; owns dispatch and transport | Keep: #668/#677/#678 supply sessions, schemas/errors and configured HTTP identity/scopes; [access migration](../sdk/docs/http-access.md) requires explicit launchers/client credentials. #670/#673/#674 still own source/review/extraction qualification |
| [server-factory.ts](../sdk/src/server-factory.ts) | All 14 MCP entrypoints; `createAnalysisTool` wraps domain results | Keep/refactor metadata in [#710](https://github.com/ryemyster/ShaleYeah/issues/710); preserve zero/absence. Schema/error work remains #677 |
| [canonical-model.ts](../sdk/src/canonical-model.ts) | Geowiz `FormationSchema`, Econobot `EconomicsSchema`, Risk `RiskProfileSchema`, Decision `DecisionSchema` | Keep/refactor role-owned mappings; tests must distinguish units, observed/assumed fields and old 0–100 scores from declared new scales |
| [types.ts](../sdk/src/types.ts) | Reporter/Decision `AnalysisInputs`, `InvestmentCriteria`, `PortfolioAsset`; parser/server interfaces | Keep supported domain types; role PRs replace inaccurate field/scale mappings, #692 removes only unused legacy interfaces |
| [file-detector.ts](../sdk/src/file-detector.ts), [file-integration.ts](../sdk/src/file-integration.ts) | `MCPServer` creates `FileIntegrationManager`, which calls detector/parsers; `file-formats.test.ts` exercises integration | Keep/refactor #670/#671/#674 reference path; supported format claim must be backed by actual parser fixtures, not extension recognition |
| [file-utils.ts](../sdk/src/file-utils.ts) | Public barrel export; only self-calls within `FileUtils` found in tracked source, no production import or dedicated test | Delete after gate #692 if no supported public consumer; retain only with an independently justified caller and meaningful I/O tests. #670/#678 file-root/source/size controls belong at the executing boundary regardless |
| [parsers/las-parser.ts](../sdk/src/parsers/las-parser.ts) | File manager; LAS parser tests cover missing file/minimal LAS 2.0 output shape | Keep candidate #671; add null sentinel, unit/depth/curve mapping, malformed/truncated and realistic expert fixtures before broader geological claims |
| [parsers/excel-parser.ts](../sdk/src/parsers/excel-parser.ts) | File manager; Excel tests check missing XLSX/minimal CSV shape | Keep candidate #670/#674; real spreadsheet/date/unit/quoted CSV and size-limit cases required for declared ingestion support |
| [parsers/gis-parser.ts](../sdk/src/parsers/gis-parser.ts), [types/shapefile.d.ts](../sdk/src/types/shapefile.d.ts) | File manager; GIS tests check missing files/basic GeoJSON shape; declaration supports shapefile dependency | Keep candidate #670/#674; verify coordinate system/order, geometry, multi-file shapefile/KML support per claimed format; preserve declaration until dependency is replaced |
| [parsers/segy-parser.ts](../sdk/src/parsers/segy-parser.ts) | File manager and advertised supported SEG-Y capability; no dedicated `parsers-segy.test.ts` in tracked tests | Keep candidate, unqualified format until #670/#674 supplies byte-order/sample-format/truncation/size fixtures; don't certify from extension/sample-file presence |
| [identifier.ts](../sdk/src/identifier.ts) | All 14 MCP entrypoints; `identifier.test.ts` | Keep bounded normalization/pagination helpers; role owners must not treat fuzzy ID similarity as source identity or permission |
| [mutual-exclusivity.ts](../sdk/src/mutual-exclusivity.ts) | Geowiz, Econobot, Title input checks; `mutual-exclusivity.test.ts` | Keep tested input-choice utility; #677 preserves failures over MCP |
| [index.ts](../sdk/src/index.ts) and [package.json](../sdk/package.json) | Root import/type surface, workspace dependency/packaging entry | Refactor exports/dependencies in each owner PR; #692 audits final unused legacy exports, #674 proves needed utilities install outside the monorepo |

The JSON-fence regex finding in `sdk/src/agent-loop.ts` was repaired in
[PR #705](https://github.com/ryemyster/ShaleYeah/pull/705), merge
`c56c750444cd067db3b5367e661282e68db2a7c2`. Current parsing trims and slices outer
fences instead of using the reported backtracking expressions. Keep
`sdk/tests/fixtures/json-fence-stress.ts` while that parser exists. #692 removes
its export/test/worker only with the parser's supported API disposition; any
replacement parser needs its own long-whitespace/literal-fence regression.
Inventory closure does not reopen, dismiss or suppress that security finding.

## Independently useful domain servers

Keep these tool packages, their source, package metadata and meaningful tests.
They remain TypeScript; replacing an employee does not retire its MCP. Each
entrypoint imports `ServerFactory`/`runMCPServer` and domain handlers, and each
has `tests/`. Those facts establish active implementation, not professional
correctness. Role issues own professional fixtures and minimum contract wiring;
independent algorithm defects get their own repair PR before role qualification.

| Tool source unit | Retain candidate | Qualification / repair owner |
| --- | --- | --- |
| [servers/geowiz/src/](../servers/geowiz/src/) | Well-log/file handling and formation analysis | #671 input provenance; #670 connectors; #674 extraction/format limits |
| [servers/econobot/src/](../servers/econobot/src/) | Explicit cash-flow NPV/IRR/payback and scenarios | #711 numerical/missing-input repair, then #680 economist/expert cases |
| [servers/curve-smith/src/](../servers/curve-smith/src/) | Decline fitting/history and forecast calculations | #712 type-curve repair, then #681 fitting/unit/forecast expert cases |
| [servers/risk-analysis/src/](../servers/risk-analysis/src/) | Named Monte Carlo samplers and risk analysis | #682 validates distribution/seed/assumption limits and human risk decisions; random sampling is not fixture fabrication |
| [servers/legal/src/](../servers/legal/src/) | Contract/regulatory/compliance analysis hooks | #683 source/jurisdiction/effective-date fixtures; licensed legal judgment stays human |
| [servers/market/src/](../servers/market/src/) | Valid EIA retrieval and commercial interpretation | #708 unsupported fallback repair, then #684 freshness/assumption cases |
| [servers/title/src/](../servers/title/src/) | Ownership/lease/burden checks and input controls | #685 source chains/access/expert qualification; no automated legal title opinion |
| [servers/drilling/src/](../servers/drilling/src/) | Program/cost/risk tools | #686 unit/assumption/design-review fixtures; estimates must be labeled |
| [servers/development/src/](../servers/development/src/) | Planning/phasing/progress tools | #687 dependency/schedule/cost assumptions and revision review |
| [servers/research/src/](../servers/research/src/) | Permitted retrieval and source synthesis | #709 unsupported finding repair, then #688 citation/coverage/access cases |
| [servers/reporter/src/](../servers/reporter/src/) | Report assembly and input-faithful synthesis | #541 field/score mapping and human publication; independent redesign requires its own issue |
| [servers/qa-server/src/](../servers/qa-server/src/) | Intended input-quality checks; current configuration-based assessments are unqualified | #538 charter, #716 observed rule-result repair before #542 employee/expert cases |
| [servers/infrastructure/src/](../servers/infrastructure/src/) | Pipeline/facility/cost/compliance tools | #689 units/engineering assumptions/source limits and human design review |
| [servers/decision/src/](../servers/decision/src/) | Investment/portfolio/bid analysis tools | #690 provenance/missing-data/expert cases; human capital authority; #675 settles coordinator distinction |

### Known replacement blockers

These observations are defects or unqualified behavior, not an invitation to
keep them because tests currently pass. Fixtures/demo assumptions may remain
only behind explicit labeling and cannot become measured or approved evidence.

| Verified source behavior | Required replacement evidence | Owner |
| --- | --- | --- |
| Geowiz `deriveDefaultFormationProperties(formations, 7000)` and fallback properties after absent/failed input | Missing measurements stay unavailable; null/units/provenance and real LAS fixtures | #671 owns first LAS path; remaining advertised capabilities must be separately qualified before #674 declares support |
| Econobot `calculateDCFMetrics` uses `|| 75`, `|| 25`, `|| 500`, fixed investment/decline; catch returns `generateDefaultAnalysis`; separate IRR helpers also lack numerical qualification | Explicit observed/assumed cash flows, timing/sign/unit fixtures, zero preservation and non-solution states | #711 before #680 |
| Curve-smith `performTypeCurveAnalysis` counts analogs but uses fixed tier rates and 1.5/0.6 factors labeled P10/P90 | Actual analog evidence or labeled scenarios, independently checked volume/units and justified uncertainty method | #712 before #681 |
| Market `deriveDefaultCompetitorProfile` makes production/cost/share from name length; `fetchEiaPrices` returns stub prices with a fresh retrieval timestamp on missing/failed API | No fabricated metrics; observation date distinct from fetch date; missing/stale source deferral | #708 before #684 |
| Research `deriveDefaultCompetitorEntry` derives activity/threat from region/index; default summaries have no claim-level source check | Cited findings or explicit missing coverage; variation/source count cannot substitute for evidence | #709 before #688 |
| SDK invented-confidence fallback removed in #710; existing role callers remain undeclared or mixed-scale | [Metadata contract and 47-call inventory](../sdk/docs/confidence-metadata.md) preserve zero and distinguish absence/invalid/unscaled scores; roles must declare tested scales and qualify score meaning | #710 qualifies the wrapper; listed role owners still required before #674/#691 |
| Reporter maps `geological.confidenceLevel` into `keyMetrics.netPay`; synthesis uses `economic?.confidence || geological?.confidenceLevel || 75` | Correct source field/units, zero/absence preservation and explicit score-scale mapping; narrow contract repair | #541; required before its role acceptance |
| QA `deriveDefaultQAResult` returns threshold-based PASS; index estimates coverage by target count and passRate by verdict; reporting has no observed result input | Authorized source snapshots and allowlisted checks with rule/version/defect evidence; actual denominators and UNTESTED/ERROR; no template certifies data | #716 before #542; charter #538; no independent algorithm redesign hidden inside employee migration |
| Generic `ServerUtils.calculateConfidence` and role hardcoded scores | Score meaning, scale and professional calibration documented/tested; no confidence value grants approval | #666/#667 define evaluation machinery; each role owns output scoring correctness |

For numerical acceptance, the
[NumPy Financial IRR definition](https://numpy.org/numpy-financial/latest/_api_stubs/numpy_financial.irr.html)
provides an independent zero-NPV equation and examples for #711. Using that
reference does not mandate a new dependency or establish petroleum-economic
fitness. The unreviewed type-curve code/comments supply no evidence that fixed
multipliers are industry-standard statistical percentiles; #712 must establish
the method and reservoir-expert limitations rather than repeat that claim.

## Tests, scripts, documentation and optional coordination

| Path/surface | Caller/evidence | Decision / owning removal or enforcement |
| --- | --- | --- |
| [contracts/](../contracts/README.md), canonical schemas/bindings, ADRs and `contracts/fixtures/` | Portable Python/TypeScript validators and current policy/composition tests | Keep; these are business records, not a framework loop. Role/reference PRs implement runtime scenarios; passing validators cannot claim execution qualification |
| Ten `agents/<role>/tests/test_adk_project_shape.py` | Every current Python package contains a guard rejecting `package.json`, `tsconfig.json`, `biome.json`, `src/agent/` and `tests/*.test.ts` | Keep/run in each role PR; extend the same guard to four migrations. #577 first reference and #691 fleet make checks required in CI |
| Ten `test_adk_mcp_execution_shape.py`, `test_adk_eval_harness_shape.py`, `tests/eval/` | Existing ADK imports/tool/eval asset shape checks | Refactor in #679/role PRs to meaningful helper/role behavior; #666/#667 own config/runner, #691 qualification. Delete assertions tied only to removed wrapper text |
| `sdk/tests/agent-loop.test.ts`, `runtime-identity.test.ts`, four employees' TS tests | Exercise current compatibility runtime and private clients | Adapter tests until owners migrate; #692 removes obsolete runtime tests only after replacement authority/context/failure regressions exist |
| SDK parser/format/identifier/error/MCP tests and each `servers/<name>/tests/` | Current tool/utility behavior | Keep meaningful assertions; owning repairs replace tests blessing fabricated results. `sdk/tests/file-formats.test.ts` logs several parser results without asserting success, so it cannot certify every format |
| [scripts/run-tests.sh](../scripts/run-tests.sh) | SDK, all 14 MCPs and four TS employees invoke it through parent-relative package scripts; excludes three named infrastructure/integration/signal test files | Adapter for test commands: #674 proves reference checks outside root; role/utility extraction must bundle/install a runner or use package-local scripts. #691 records excluded tests/qualification limits; no silent success from a missing tests directory |
| [scripts/add-perf-hints.mjs](../scripts/add-perf-hints.mjs) | One-off updater for old `agents/<role>/src/agent/index.ts`; tracked search found only its own run comment, no package/CI caller | Delete after gate #692 after confirming no supported contributor caller; #498 removes stale command guidance if found. Do not run it against migrated employees |
| [pnpm-workspace.yaml](../pnpm-workspace.yaml), [pnpm-lock.yaml](../pnpm-lock.yaml), [turbo.json](../turbo.json) | TS tool/SDK/legacy-agent build/test workspace | Keep for TS units; owner PRs remove displaced dependency/agent tasks. `agents/*` glob is not itself an agent npm implementation; package-local guards prevent one reappearing |
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | Runs issue-template/SDLC, root Turbo TS checks, contracts isolation and #679 helper/Geologist checks, wheel isolation and actual protected Geowiz control | Keep; other Python employees/runtime job evals are not yet enforced. #577/#691 close that remaining gap; local ignored hooks are not shared CI |
| [scripts/sdlc.mjs](../scripts/sdlc.mjs), its tests and [scripts/git-hooks/](../scripts/git-hooks/), [docs/sdlc.md](sdlc.md) | Shared sequential branch/PR/merged-check delivery contract | Keep; necessary process, not runtime bloat. Preserve Codex/Antigravity/Claude Code entrypoints |
| [.github/ISSUE_TEMPLATE/](../.github/ISSUE_TEMPLATE/), [scripts/check-issue-spec-template.mjs](../scripts/check-issue-spec-template.mjs) | Issue form and CI spec checks | Keep; each replacement needs one scoped issue and acceptance evidence |
| [orchestrator/src/index.ts](../orchestrator/src/index.ts), [orchestrator/package.json](../orchestrator/package.json) | Version-constant stub; unused workspace SDK dependency; no implemented Temporal workflow | #675 charter selects this optional unit; #676 replaces stub, unused workspace dependency and stale #362-only/full-deal assumptions with the bounded ADK/Python pilot. Don't present it as running or require it for employees |
| [README.md](../README.md), [docs/ARCHITECTURE.md](ARCHITECTURE.md), [docs/topology.md](topology.md), package README/`docs/`/CHANGELOG | Public setup, architecture, commands and support claims | Owner PR updates current behavior, deletes obsolete command/transport examples and records limits. #498 owns shared contributor setup, #578 portable support matrix, #692 final residue audit |
| Ignored local `.agents/`, `.claude/`, `AGENTS.md`, caches, `dist/`, `node_modules/`, `.venv/` | Local tooling/build/dependency artifacts, not tracked source in this ledger | Exclude from source-bloat/deletion claims and staging. No authorization to erase maintainer's local notes or preexisting files |

## Mandatory replacement and extraction gate

Each owning PR includes a displaced-code table with **path, old behavior,
current callers, replacement evidence, deletion or retained-adapter reason,
owning issue and expiry**. No old reasoning loop remains beside ADK after an
employee's acceptance. No migrated employee adds an npm/package.json/tsconfig or
`src/agent` surface. The existing package-shape guards enforce those absences
when run; #577/#691 must enforce them in shared required checks.

1. **Control:** install/build/run/test the employee and MCP separately outside
   this checkout using declared, versioned dependencies. Copying a folder with
   `workspace:*` or parent-relative test scripts is insufficient. Preserve
   useful parsers/calculations only with input/output/format correctness evidence.
2. **Edge:** search imports, public exports, package/workspace locks, start/build/
   test/eval commands, CI, fixtures and docs for removed symbols/paths. Exercise
   missing data, tool/model errors, cancellation, restart, changed revisions and
   stale/malformed sources. If a supported caller remains, retain an explicitly
   expiring adapter and do not claim final deletion.
3. **Authority boundary:** accepted replacement must enforce trusted identity,
   source/task access, exact-revision human review and redacted durable audit at
   the executing backend. Preserve useful old regression requirements even
   where current optional scopes/approval booleans are insufficient. Deterministic
   guards, domain-expert correctness and optional configured LLM rubric scores
   are distinct evidence; generated prose cannot promote memory or authorize
   legal/capital/publication actions.
4. **Composition:** run required combinations from
   [ADR 0004](../contracts/docs/0004-composition-conformance.md), including generic
   client → our MCP and compatible external tool → our employee. Record actual
   protocol/dependency versions and computed evidence digests. An employee must
   work without its paired MCP or a coordinator where the declared contract allows.
5. **Documentation:** update package install/run/config/review/eval/support docs
   and changelogs in the same PR. Remove obsolete instructions/tests with their
   path; keep a historical changelog as history, not a live command contract.

#674 proves the first reference pair's extraction/composition envelope; later
role PRs prove their own. #692 verifies final shared runtime/public-export/command
cleanup after the last role migration. #691 requires fleet qualification,
#693 assembles the exact develop candidate, and #694 records human acceptance.
None of those acceptance results is supplied by closing this inventory issue.

## How to refresh this ledger

Run from the repository root. `git ls-files` enumerates tracked source; `rg`
searches it for callers and obsolete symbols. Review tests and public metadata
alongside the results; search absence alone is not public-API compatibility.

```bash
git ls-files agents sdk servers orchestrator scripts .github
rg -n 'runAgentTask|LocalAgentRuntime|LocalAgentEndpoint|ContextStore|defaultAsyncJobPoller|CompensationRegistry' agents sdk/src sdk/tests servers orchestrator docs
rg -n 'package.json|tsconfig.json|biome.json|dangling_npm' agents/*/tests/test_adk_project_shape.py
rg -n 'workspace:|run-tests.sh|src/agent|dist/agent' sdk/package.json agents/*/package.json servers/*/package.json orchestrator/package.json pnpm-workspace.yaml
```

For each Python employee, run its documented project-shape check from that
package, for example `uv run pytest tests/test_adk_project_shape.py`. #576 also
verified the existing absence guards against temporary forbidden-file controls;
it did not change those tests. Negative controls use temporary copies, not real
employee package files. Re-run after each migration and update the affected row.

## Provider replacement in #669

Deleted Geowiz’s hardcoded Anthropic call, missing-key/model-error demo synthesis,
TOC/recommendation replacement helpers and obsolete live-key anti-stub tests.
The retained `deriveDefaultFormationProperties` export has legacy utility tests
and is no longer called by formation synthesis; #671 owns remaining geological
estimates/source repair. SDK `callLLM` remains an explicit compatibility entry
point for 13 unmigrated servers and four TypeScript employees, with removal
owned by #692/#576. Native reference adapters and dependencies are pinned.
