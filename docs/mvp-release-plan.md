# MVP delivery and acceptance plan

SHALE YEAH helps oil-and-gas professionals review evidence, prepare work products
and make decisions with less manual work. Each specialist agent acts as an
employee with a defined job and a human owner. The human checks inputs, reviews
outputs and approves the decisions that require professional judgment.

This is the committed delivery ledger for the minimum viable product (MVP).
It covers all 14 existing specialists and a bounded Chief of Staff pilot. Every
row owns one outcome and one pull request (PR). Completing the plan document in
[#664](https://github.com/ryemyster/ShaleYeah/issues/664) establishes the ledger;
the remaining rows establish working behavior and release evidence.

## Baseline and scope

The initial backlog was checked against GitHub on 2026-10-07: 45 open MVP issues.
This branch began at develop commit
`c1a63e824f0f7d18d491a4304e690f9ed355b9a4`. Sequential delivery prerequisites
[#696](https://github.com/ryemyster/ShaleYeah/issues/696) and
[#698](https://github.com/ryemyster/ShaleYeah/issues/698) are closed and merged
through [#697](https://github.com/ryemyster/ShaleYeah/pull/697) and
[#699](https://github.com/ryemyster/ShaleYeah/pull/699), with their merge checks
verified. Existing package tests and migrations provide starting evidence;
professional workflow acceptance is still required.

The MVP keeps a monorepo containing independently usable agent and tool-server
packages. Google's Agent Development Kit (ADK), using Python, is the primary
agent authoring surface. Model Context Protocol (MCP) servers expose bounded
tools and may use TypeScript. Domain calculations, parsers and useful tool logic
are retained where their behavior can be verified. New behavior replaces its
displaced source, prompts, fixtures, commands and documentation in the owning PR.

An employee's durable boundary is its job charter, task, evidence, work product,
context manifest, review decision and evaluation result. Models, ADK or other
runtimes, MCP clients, storage, retrieval and deployment are replaceable adapters.
[ADR 0001](adr/0001-durable-employee-contracts.md), owned by
[#567](https://github.com/ryemyster/ShaleYeah/issues/567), records the architecture
decision and transferred #569 operating-mode scope. #568 publishes exact schemas
and bindings; #572 selects tested protocol/composition profiles. Roman names
remain display identities alongside explicit role and capability IDs.

The plan includes role-specific data hooks, configurable evaluations, persistent
working context, human review and restart-safe continuation. The Chief of Staff
pilot coordinates Geologist and Research Analyst in one diligence workflow;
every specialist also works independently. Chief of Staff authority and its
relationship to Investment Chair remain decisions owned by #675.

The [employee role matrix](employee-role-matrix.md), owned by #665, specifies
required and optional inputs, work products, role-local context, source/access
limits, configurable scorecards and human review for all 14 specialists plus
Chief of Staff. Its four case families per role feed #666/#667 and each adoption
issue. Professional thresholds and actual operator workflow acceptance remain
explicit validation work; documented sources do not certify live connectors.

## Deliver one issue at a time

Follow [sdlc.md](sdlc.md) and [CONTRIBUTING.md](../CONTRIBUTING.md). These commands
run from the repository root and apply to Codex, Antigravity and Claude Code:

1. Confirm the issue is open, its scope is approved and its prerequisites have
   acceptance evidence. Run `pnpm sdlc status`, then
   `pnpm sdlc start <issue-number> <slug>` to branch from freshly fetched develop.
2. For behavior changes, write failing tests or evaluations before implementation.
   For research and documentation, define the evidence checklist before drawing
   conclusions. Implement one outcome, delete displaced code and update affected
   docs and the changelog. Split newly discovered independent work into another
   issue and add it to this ledger.
3. Run appropriate package checks and review. Push the registered branch and open
   one PR into develop with `Fixes #<issue-number>` and the recorded `SDLC-Base`.
   Wait for passing checks and review before merging.
4. Wait for the merged commit's required CI (continuous integration) checks.
   Verify the issue's acceptance criteria, record evidence and run
   `pnpm sdlc complete <pr-number>`. This updates develop and releases the slot.
5. Start the next issue from that updated develop commit. Independent items still
   go through this sequence; they do not use parallel implementation branches.

Every accepted row needs its merged PR URL, merge SHA, verification commands and
results, relevant evaluation report, known limitations and deletion outcome.
Record these in the issue and PR. A closed issue without this evidence cannot
satisfy a release gate. Update this ledger in the owning PR when scope,
dependencies, support claims or required repairs change.

The only PR targeting main is the future release in #695, with head develop.
The shared CLI currently supports feature delivery into develop; #695 owns the
release procedure and synchronization. Its acceptance is checked separately.

## Dependency-ordered delivery ledger

Execute top to bottom. Dependencies in a row must be accepted first. A row may
also reference historical research listed below; its closed state supplies
background, not current professional qualification. The order conservatively
finishes shared research and contracts before consumers even when an issue
allows earlier drafting. Additional transport prerequisites on #673 and #674
make the entire reference journey verifiable.

Every row is required for this MVP. Initial delivery state is open for all 45
rows; check GitHub and merged evidence for current status. Outcomes and evidence
below are the completion minimums, supplemented by each linked issue's spec.

### Foundations and decisions

| Order | Owning issue | Single outcome | Direct prerequisites | PR base | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | [#664](https://github.com/ryemyster/ShaleYeah/issues/664) | Commit this finite delivery and acceptance ledger | #696, #698 (accepted) | develop | All required issues and roles mapped; dependency order and release/support gates verified |
| 2 | [#567](https://github.com/ryemyster/ShaleYeah/issues/567) | Commit the durable-contract and replaceable-adapter architecture decision | None | develop | Ownership, dependency directions, technology replacement and excluded scope are explicit |
| 3 | [#665](https://github.com/ryemyster/ShaleYeah/issues/665) | Commit a workflow, context, evaluation and data-source matrix for all roles | None | develop | Primary industry sources, inputs/outputs, human decisions, data rights and unresolved gaps for every role |
| 4 | [#568](https://github.com/ryemyster/ShaleYeah/issues/568) | Implement versioned employee, task, work-product, context and review contracts | #567 | develop | Valid and invalid contract cases; version/compatibility behavior; independent consumers |
| 5 | [#571](https://github.com/ryemyster/ShaleYeah/issues/571) | Commit the lifecycle for private employee context and reviewed shared knowledge; include the maintainer-requested SDK JSON-fence regex repair | #567, #568 | develop | Ownership, retention, retrieval budgets, provenance, access rules and reviewed promotion specified; parser behavior/stress tests and CodeQL repair verified |
| 6 | [#573](https://github.com/ryemyster/ShaleYeah/issues/573) | Specify authenticated authority and approval bound to the reviewed revision | #567 | develop | [ADR 0003](../contracts/docs/0003-authority-and-review.md) specifies identity/scopes, exact input/product/action binding, secrets, audit/redaction and stale/replayed approval cases; validator examples execute, runtime enforcement remains assigned |
| 7 | [#572](https://github.com/ryemyster/ShaleYeah/issues/572) | Commit BYO-agent and MCP composition conformance requirements | #568, #573 | develop | Compatible replacement, missing capability, protocol/version mismatch and access-denial cases defined |
| 8 | [#576](https://github.com/ryemyster/ShaleYeah/issues/576) | Commit an actionable keep, cut and replace inventory | None | develop | Current callers, retained behavior/tests, deletion owner and replacement gate for each legacy surface |
| 9 | [#578](https://github.com/ryemyster/ShaleYeah/issues/578) | Commit the portable-package and deployment-support matrix | #567 | develop | Each target labeled intended, verified or deferred, with commands, evidence requirements and limits |
| 10 | [#498](https://github.com/ryemyster/ShaleYeah/issues/498) | Align contributor setup with package-local ADK authoring and delivery | #567, #664 | develop | New contributor can follow package-local setup and verification; commands and paths checked |
| 11 | [#538](https://github.com/ryemyster/ShaleYeah/issues/538) | Commit the QA employee charter and data-quality review handoffs | #665, #568 | develop | QA responsibilities, evidence, input-quality cases and human decision boundaries specified |
| 12 | [#675](https://github.com/ryemyster/ShaleYeah/issues/675) | Commit Chief of Staff authority, delegation and context handoffs | #665, #567, #568, #571, #573 | develop | Human owner, permitted decisions, Investment Chair relationship and bounded delegation cases specified |

### Shared implementation and Geologist reference

| Order | Owning issue | Single outcome | Direct prerequisites | PR base | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| 13 | [#668](https://github.com/ryemyster/ShaleYeah/issues/668) | Isolate MCP HTTP sessions and manage their lifecycle | #572 | develop | Separate clients stay isolated; restart, closure and failure do not leak or reuse another session |
| 14 | [#677](https://github.com/ryemyster/ShaleYeah/issues/677) | Preserve MCP schemas and failure results from tool to employee | #568, #572 | develop | Schema-driven validation and structured error results survive the full call path |
| 15 | [#678](https://github.com/ryemyster/ShaleYeah/issues/678) | Enforce configured identity and scopes at MCP HTTP entry | #573, #572 | develop | Allowed/denied/missing identity and scope cases; identity reaches audit without exposing secrets |
| 16 | [#679](https://github.com/ryemyster/ShaleYeah/issues/679) | Install a reusable Python MCP client across employee packages | #668, #677, #678, #568 | develop | Isolated installation and transport regressions pass; role wrappers keep typed behavior; displaced copies removed |
| 17 | [#669](https://github.com/ryemyster/ShaleYeah/issues/669) | Configure model providers across the complete Geologist execution path | #568, #573 | develop | Provider switch includes model-assisted server calls; unsupported settings fail clearly; secrets remain outside outputs |
| 18 | [#670](https://github.com/ryemyster/ShaleYeah/issues/670) | Implement role connector contracts and an operator-supplied file adapter | #568, #573 | develop | Provenance/access/availability contracts and valid, missing, denied and malformed file cases |
| 19 | [#666](https://github.com/ryemyster/ShaleYeah/issues/666) | Implement declarative employee evaluation profiles and trusted metrics | #568, #573 | develop | Configuration changes cases/rubrics/thresholds without code; unknown metrics and unsafe config rejected |
| 20 | [#667](https://github.com/ryemyster/ShaleYeah/issues/667) | Run configured evaluations through ADK and emit portable results | #666 | develop | Repeatable fixture runs; metric/judge/profile versions recorded; failures retain actionable evidence |
| 21 | [#574](https://github.com/ryemyster/ShaleYeah/issues/574) | Correlate task, context, evaluation, review and tool events | #568, #573 | develop | One journey can be traced across boundaries; structured export, denial/failure and redaction checks |
| 22 | [#671](https://github.com/ryemyster/ShaleYeah/issues/671) | Make Geowiz inputs, provenance and missing-data behavior explicit | #670, #568 | develop | Realistic good/missing/invalid inputs; assumptions and sources shown; absent evidence does not become a fact |
| 23 | [#672](https://github.com/ryemyster/ShaleYeah/issues/672) | Persist and assemble bounded Geologist working context | #568, #571, #573, #670 | develop | Restart recovery, budget limits, provenance, stale context and employee/customer isolation |
| 24 | [#673](https://github.com/ryemyster/ShaleYeah/issues/673) | Implement Geologist review, revision and restart-safe continuation | #573, #574, #668, #671, #672, #667, #677, #678, #679 | develop | Human review/changes/resume completes; stale or unauthorized approval fails; restart resumes the correct revision |
| 25 | [#577](https://github.com/ryemyster/ShaleYeah/issues/577) | Gate reference releases and runtime changes on configured evaluations | #666, #667, #573, #574 | develop | CI rejects contract, trust and job-quality regressions; #671/#672/#673 cases included before #674 acceptance |
| 26 | [#674](https://github.com/ryemyster/ShaleYeah/issues/674) | Prove Geologist and Geowiz work as isolated packages and containers | #568, #572, #577, #668, #669, #671, #672, #673, #677, #678, #679 | develop | Clean install and container journey with context, provider switch and human review; no hidden monorepo runtime dependency |

### Employee rollout

Each role PR adopts the accepted reference components, its own professional
fixtures and the shared employee acceptance matrix below. It removes displaced
role-local source and documents independent operation. The Geologist reference
uses four separate outcomes above; each other role has one bounded adoption PR.
Independent defects discovered during adoption receive their own repair issue.

| Order | Owning issue | Single outcome | Direct prerequisites | PR base | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| 27 | [#541](https://github.com/ryemyster/ShaleYeah/issues/541) | Migrate Reporter to the reference employee contracts | #674, #568, #571, #572, #573, #577, #679 | develop | Reporting fixtures, source-linked work product, human edits/review, isolated operation and TypeScript removal |
| 28 | [#542](https://github.com/ryemyster/ShaleYeah/issues/542) | Migrate QA to the reference employee contracts | #674, #538, #568, #571, #572, #573, #577, #679 | develop | Data-quality failures and review handoffs, independent checks, context/evaluations and TypeScript removal |
| 29 | [#680](https://github.com/ryemyster/ShaleYeah/issues/680) | Migrate Economist | #674, #665, #679 | develop | Financial assumptions/calculations reviewed; common employee checks; TypeScript removal |
| 30 | [#681](https://github.com/ryemyster/ShaleYeah/issues/681) | Migrate Reservoir Engineer | #674, #665, #679 | develop | Curve inputs, units and forecast limitations reviewed; common checks; TypeScript removal |
| 31 | [#682](https://github.com/ryemyster/ShaleYeah/issues/682) | Adopt employee contracts for Risk Analyst | #674, #665, #679 | develop | Reproducible risk cases and assumptions; common employee checks |
| 32 | [#683](https://github.com/ryemyster/ShaleYeah/issues/683) | Adopt employee contracts for Legal Analyst | #674, #665, #679 | develop | Source/jurisdiction evidence and human legal review; common employee checks |
| 33 | [#684](https://github.com/ryemyster/ShaleYeah/issues/684) | Adopt employee contracts for Market Analyst | #674, #665, #679 | develop | Dated market evidence and stale/missing-source cases; common employee checks |
| 34 | [#685](https://github.com/ryemyster/ShaleYeah/issues/685) | Adopt employee contracts for Title Analyst | #674, #665, #679 | develop | Ownership evidence, conflicts and professional review; common employee checks |
| 35 | [#686](https://github.com/ryemyster/ShaleYeah/issues/686) | Adopt employee contracts for Drilling Engineer | #674, #665, #679 | develop | Engineering constraints, evidence and human review; common employee checks |
| 36 | [#687](https://github.com/ryemyster/ShaleYeah/issues/687) | Adopt employee contracts for Development Planner | #674, #665, #679 | develop | Development alternatives, assumptions and human review; common employee checks |
| 37 | [#688](https://github.com/ryemyster/ShaleYeah/issues/688) | Adopt employee contracts for Research Analyst | #674, #665, #679 | develop | Cited findings, conflicting/untrusted evidence and bounded context; common employee checks |
| 38 | [#689](https://github.com/ryemyster/ShaleYeah/issues/689) | Adopt employee contracts for Infrastructure Planner | #674, #665, #679 | develop | Infrastructure constraints, source limitations and review; common employee checks |
| 39 | [#690](https://github.com/ryemyster/ShaleYeah/issues/690) | Adopt employee contracts for Investment Chair | #674, #665, #679 | develop | Evidence-linked investment synthesis and human decision boundary; common employee checks |

### Coordination, qualification and release

| Order | Owning issue | Single outcome | Direct prerequisites | PR base | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| 40 | [#676](https://github.com/ryemyster/ShaleYeah/issues/676) | Coordinate one Geologist/Research Analyst diligence workflow | #675, #674, #568, #571, #572, #573, #574, #577, #688, #679 | develop | Bounded delegation and evidence handoffs; private context stays private; failed/unreviewed outputs cannot authorize action |
| 41 | [#691](https://github.com/ryemyster/ShaleYeah/issues/691) | Require configured qualification across all 14 employees | #577, #541, #542, #680–#690, #671, #672, #673, #674 | develop | All role checks discovered and required; failed role/contract/trust cases block; no live key required for fixtures |
| 42 | [#692](https://github.com/ryemyster/ShaleYeah/issues/692) | Delete obsolete shared runtime after its last consumer migrates | #576, #541, #542, #680–#690 | develop | Import/export and command audit has no retained caller; obsolete runtime/tests/docs removed; replacement regression checks pass |
| 43 | [#693](https://github.com/ryemyster/ShaleYeah/issues/693) | Qualify the integrated develop candidate for operator testing | All rows 1–42, including #676, #691 and #692 | develop | Exact candidate revision, clean setup, full role/reference/coordination checks, supported modes and known limitations recorded |
| 44 | [#694](https://github.com/ryemyster/ShaleYeah/issues/694) | Record human MVP acceptance on the qualified candidate | #693 | develop | Named authorized reviewers, reviewed revisions, job-quality judgments and observed manual effort; blockers repaired and retested |
| 45 | [#695](https://github.com/ryemyster/ShaleYeah/issues/695) | Promote accepted develop to main | All rows 1–44, including #693 and #694 | main (head develop) | Candidate/release relationship verified; human sign-off, checks, release notes and rollback/runbook evidence; post-merge checks pass |

## Complete employee coverage

These are the 14 role packages and their matching tool servers. Historical
research issues were confirmed closed on 2026-10-07. #665 revisits their evidence
and fills gaps before adoption; historical closure does not waive current tests.

| Employee | Package | MCP server | Owning outcome(s) | Historical research input |
| --- | --- | --- | --- | --- |
| Geologist | `agents/geologist` | `servers/geowiz` | #671, #672, #673, #674 | Reassessed in #665 |
| Reporter | `agents/reporter-agent` | `servers/reporter` | #541 | [#540](https://github.com/ryemyster/ShaleYeah/issues/540) |
| Quality Assurance | `agents/quality-assurance` | `servers/qa-server` | #542 | Current charter #538 |
| Economist | `agents/economist` | `servers/econobot` | #680 | [#522](https://github.com/ryemyster/ShaleYeah/issues/522) |
| Reservoir Engineer | `agents/reservoir-engineer` | `servers/curve-smith` | #681 | [#520](https://github.com/ryemyster/ShaleYeah/issues/520) |
| Risk Analyst | `agents/risk-analyst` | `servers/risk-analysis` | #682 | [#529](https://github.com/ryemyster/ShaleYeah/issues/529) |
| Legal Analyst | `agents/legal-analyst` | `servers/legal` | #683 | [#524](https://github.com/ryemyster/ShaleYeah/issues/524) |
| Market Analyst | `agents/market-analyst` | `servers/market` | #684 | [#525](https://github.com/ryemyster/ShaleYeah/issues/525) |
| Title Analyst | `agents/title-analyst` | `servers/title` | #685 | [#526](https://github.com/ryemyster/ShaleYeah/issues/526) |
| Drilling Engineer | `agents/drilling-engineer` | `servers/drilling` | #686 | [#537](https://github.com/ryemyster/ShaleYeah/issues/537) |
| Development Planner | `agents/development-planner` | `servers/development` | #687 | [#533](https://github.com/ryemyster/ShaleYeah/issues/533) |
| Research Analyst | `agents/research-analyst` | `servers/research` | #688 | [#536](https://github.com/ryemyster/ShaleYeah/issues/536) |
| Infrastructure Planner | `agents/infrastructure-planner` | `servers/infrastructure` | #689 | [#544](https://github.com/ryemyster/ShaleYeah/issues/544) |
| Investment Chair | `agents/investment-chair` | `servers/decision` | #690 | [#545](https://github.com/ryemyster/ShaleYeah/issues/545) |

The optional-at-deployment Chief of Staff has charter #675 and pilot #676. Those
issues decide its package location and implementation. It consumes permitted
work products and handoffs rather than all employees' private memory.

## Common employee acceptance matrix

An evaluation (eval) checks whether an employee performs its job correctly. The
shared runner and contracts are common; the professional cases and human
judgments belong to each role. #665 specifies them, #666/#667 provide configurable
execution, and the role PRs supply realistic fixtures.

| Capability | Required evidence | Owning work |
| --- | --- | --- |
| Job and work product | Versioned responsibility, explicit inputs/outputs, units, source references, assumptions and uncertainty; good/missing/invalid input cases | #568, #665, role outcome |
| Configurable evaluations | Cases, rubrics and thresholds change through validated config; new executable metrics remain trusted code; profile/runtime/model/judge versions recorded | #666, #667, #577, #691 |
| Own context | Persistent task and working state; bounded retrieval; provenance/freshness; private access and reviewed shared promotion; restart/isolation checks | #571, #672, role outcome |
| Data hooks | Operator files plus a documented connector boundary for public, internal and licensed sources; missing/denied/malformed/stale data and source rights visible | #665, #670, #671, role outcome |
| Human review | Authenticated reviewer sees evidence and assumptions, revises or rejects, and resumes the correct task; approvals tied to exact revision; stale/replayed decisions rejected | #573, #673, role outcome |
| Independent operation | Package-local install/run/checks; permitted tool backend; no reliance on coordinator or hidden repo-relative runtime imports; extraction evidence | #572, #679, #674, role outcome |
| Observable execution | Correlated task/tool/context/eval/review events; failures and denials visible; secrets redacted before logs, exports, artifacts and memory | #573, #574, #678, role outcome |
| Safe replacement | Same contracts and professional cases pass after supported provider/runtime changes; unsupported capabilities fail explicitly | #567, #572, #669, #674, role outcome |

Deterministic contract and policy checks judge structural behavior. A domain
expert judges professional correctness. Configured model-based rubric scoring
can supplement those checks; it does not grant authority or replace required
human sign-off. Professional thresholds and cases remain unresolved until the
owning research, eval and role issues specify them.

## Provider and deployment support matrix

Bring your own (BYO) model/key means supplying a model endpoint and credentials.
BYO-agent means replacing an employee implementation or runtime. BYO-data means
using an operator's files or source connectors. BYO-coordinator means composing
employees through an external control plane. Each requires its own conformance
evidence; a model-provider switch does not prove agent-runtime replacement.

The following are delivery targets, not certification claims. At this plan's
baseline, support is unqualified unless evidence from the owning issue proves
the stated mode. #578 refines the matrix and #674 supplies reference portability
evidence. Role PRs record their own limits; #693 reconciles release support.

| Mode | MVP requirement | Current qualification | Evidence owner |
| --- | --- | --- | --- |
| Local package execution | Agent and MCP server install/run independently with fixture checks; orchestration optional | Requires clean isolated verification | #498, #674, role outcomes, #693 |
| Container execution | Reference agent/server install and run with externalized config, review and restart behavior | Requires verified container journey; fleet claims limited to role evidence | #578, #674, #693 |
| BYO model/key | At least two configured provider paths pass with fixture clients across the reference path; exact providers/versions selected in #669 | Fixture conformance pending; paid smoke runs are opt-in and any live-provider claim needs recorded evidence | #669, #674, #693 |
| BYO-agent/runtime | Required composition cases selected in #572 pass with compatible fixtures; external employee replacement is explicitly classified | Conformance pending; no named alternative runtime is certified by selecting ADK | #572, #674, #693 |
| BYO-data | Operator-supplied file adapter works; each role documents public/internal/licensed hooks and source requirements | File/reference verification and role-specific sources pending | #665, #670, #671, role outcomes |
| BYO-coordinator | Employees work standalone; bounded Chief of Staff pilot uses granted authority and work-product handoffs | Pilot pending; external coordinators require declared conformance | #572, #675, #676, #693 |
| VM, Fly.io, Cloud Run, GKE, Agent Runtime or other hosted platforms | Configuration and packaging preserve portability | Platform-specific certification deferred unless added with its own issue and evidence | #578 |
| Commercial connectors, Snowflake, hosted vector services | Keep replaceable interfaces and explicit access requirements | No mandatory service; paid connectors and deployment certification outside initial scope | #665, #670, #578 |

The MVP requires role connector boundaries and source-specific evidence cases,
not purchased access to every commercial dataset. Any source essential to a
role's accepted workflow must be available with rights and tested evidence, or
that workflow stays blocked. An unimplemented connector must be labeled as a
hook with its limits. #665 determines minimum source coverage for each role.

Credentials are resolved from secret references outside prompts and work
products. No fixed cloud, model vendor, vector database or data warehouse is
required by the business contracts. Exact storage/retrieval choices and context
budgets are decisions in #571/#672; protocol versions are tested dependencies
whose upgrades must rerun applicable conformance and role checks.

## Cleanup ownership

#576 commits the caller-backed inventory before broad source deletion. Delete
each role's displaced runtime/adapters in its adoption PR, after replacement
tests pass. #541/#542/#680/#681 own the remaining TypeScript agent migrations.
#679 owns duplicated Python transport consolidation. #692 deletes shared custom
runtime infrastructure once the final consumer is removed. An exported API with
no internal caller still needs compatibility and release impact reviewed.

Transport-session mechanics stay adapter-local. #572 declares tested MCP profiles;
#668 repairs lifecycle for supported session-based adapters. Modern stateless
support needs separate conformance evidence. Domain context and review identity
must survive either transport. Existing moving model aliases must be resolved or
explicitly limited in #669/#577 and role adoption before an accepted release;
the architecture PR does not upgrade runtime dependencies.

Keep verifiable domain calculations, canonical data models, parsers and bounded
tool logic. Large files are split where ownership/testing requires it. Temporary
coexistence must name the retained adapter, its reason and a deletion issue.
Documentation alone does not justify deleting active callers or their trust
checks. Known security findings, including the existing agent-loop regex finding
recorded on #576, must have an explicit remediation/disposition and verification
before qualification in #693.

## MVP entry, exit and release gates

### Entry to implementation

This plan, the shared sequential workflow and an approved issue scope permit
work on the next row. Runtime implementation starts only after its prerequisite
contracts, trust and composition decisions have acceptance evidence. A missing
role, missing required behavior or issue containing unrelated outcomes blocks
that work until the gap has an owning issue or the scope is split.

### Entry to human MVP testing: #693

All required rows 1–42 have merged acceptance evidence. The integrated develop
candidate passes clean setup, isolated package/container checks, all 14 role
scorecards, the human-review reference journey, provider/conformance checks and
the bounded coordinator workflow. The support matrix is accurate for that
revision. Security/trust findings and required missing behavior have a recorded
resolution. Capture the exact tested SHA, commands, environment/config/profile
versions, reports, source rights and limitations in the qualification report.

### Exit from human MVP testing: #694

Authorized human/domain reviewers exercise real job scenarios on the qualified
revision. They inspect inputs, sources, assumptions and work products; request
changes; reject or approve the right revision; and resume after interruption.
Record who reviewed what, the actual outcome, remaining limitations and observed
manual effort against the agreed workflow baseline. A promise of time savings
is insufficient. Availability of these reviewers is an execution dependency.

Required defects become separate bounded issues and PRs into develop. Update
this ledger with each repair's owner and prerequisites. Rerun affected checks,
integrated qualification and human acceptance as required before calling the
candidate accepted. Missing evidence, failed job quality, fabricated sources,
cross-employee context leakage or bypassed human authority block acceptance.

### Release to main: #695

Link the complete issue/PR ledger, qualification and human acceptance reports,
support matrix, release notes and rollback/runbook evidence. Verify that the
release candidate matches the accepted behavior and that required checks pass.
Any runtime, config, prompt, eval or dependency change after testing invalidates
the affected evidence until retested. Evidence-only documentation commits must
record their relationship to the tested revision and prove behavior is unchanged;
record the final release SHA rather than silently treating an older SHA as tested.

Only then review and merge the develop-to-main release PR. Check the released
revision and synchronize develop using the release procedure. Record release
version/SHA, checks, acceptance links and limits. Neither merging #664 nor
closing all issues automatically establishes MVP acceptance or enterprise
readiness.

## Decisions still to resolve

| Decision | Owner | Completion requirement |
| --- | --- | --- |
| Exact role workflows, professional thresholds, source availability and rights | #665, #538, role outcomes | Cited domain evidence, realistic cases and accountable human reviewers |
| Exact schemas, initial versions/bindings and tested composition profiles under ADR 0001 | #568, #572 | Published schemas and explicit supported/unsupported capability behavior |
| Context storage/retrieval, budgets, retention and reviewed knowledge promotion | #571, #672 | Policy and restart/isolation/staleness evidence |
| Identity, scopes, reviewer enrollment and revision-bound approval | #573, #678, #673 | Trusted enforcement and negative/replay tests |
| Supported provider pairs, runtimes and deploy modes | #669, #572, #578, #674 | Exact versions, commands and qualification limits |
| Chief of Staff authority and separation from Investment Chair | #675 | Approved charter before #676 implementation |
| Configured scoring thresholds and trusted judge/metric registry | #666, #667, #577, #691 | Versioned profiles and gates; ordinary tuning does not require source edits |
| Required GitHub merge protection | #577, #691 | Required checks and current-base enforcement verified; local hooks alone are insufficient |

These decisions refine this ledger through their owning PRs. Required newly
discovered work is added before readiness is claimed. Broader commercial
connectors, large independent algorithm rewrites, unrestricted coordination and
untested hosted-platform certification remain separate scope.
