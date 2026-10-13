# QA MCP server

Testius Validatus checks whether supplied data meets an approved set of rules.
For example, it can identify a missing measurement, a wrong unit, a duplicate
well record, or a disagreement with another employee's result. MCP (Model
Context Protocol) lets an agent or another client call these tools.

This server performs **observed checks on supplied data**. The QA employee uses
these results to help its human colleague review defects. The employee's ADK
(Python Agent Development Kit) workflow is a separate package and delivery step.
A data or producing owner decides whether to repair a source, waive a defect,
accept an assessment, or publish a report. These tools create private drafts;
they provide no approval, waiver, repair or publication action.

## Run a synthetic example

Use Node >=22.13, the repository's pinned pnpm version, and the package setup in
[Getting Started](../../docs/GETTING_STARTED.md). From the repository root:

```sh
pnpm --dir contracts build
pnpm --dir sdk build
pnpm --dir servers/qa-server build
node servers/qa-server/examples/create-fixture.mjs /private/tmp/qa-example
QA_CONFIG_FILE=/private/tmp/qa-example/qa.json pnpm --dir servers/qa-server start
```

The example directory must be empty and private. The generator creates two
synthetic sources, eight rules, one scoped task and a private configuration.
Their permissions expire after one hour. The server then speaks MCP over its
standard input and output; diagnostics go to standard error. Connect an MCP
client to the start command. [Integration](docs/INTEGRATION.md) describes the
request metadata and exact tool arguments. Starting without configuration
supports discovery; data checks remain blocked.

## Tools

| Tool | Purpose |
| --- | --- |
| `get_qa_status` | Discover supported formats, rules and review boundaries |
| `run_quality_tests` | Evaluate the authorized task with its approved profile and save an immutable private result |
| `generate_quality_report` | Read that exact recorded result under current source export rights |
| `triage_quality_result` | Request an optional, unreviewed BYO-model note; model failure leaves the observed result intact |

Supported inputs are `normalized-qa-data@0.1.0` and canonical
`work-product@0.1.0`. Raw LAS logs, CSV files, connector responses and petroleum
interpretation require their owning parser and qualified normalization first.
Well and time-period join keys must be explicit; names are never fuzzy matched.

Rules cover completeness, reference-backed correctness, units, asset/well
identity, duplication, freshness, provenance and cross-role contradiction.
Edit approved JSON profiles to change their fields, tolerance, applicability,
severity or repair owner. Every approval seals the profile's version and hash.
Unsupported rules and script fields are rejected.

Results distinguish `PASS`, `FAIL`, `UNTESTED`, `ERROR` and `NOT_APPLICABLE`.
They retain source and rule versions, hashes, locations, row counts and owners.
Rates are fractions; a missing denominator yields `null`. Source coverage counts
fully assessed applicable rules. It does not measure employee accuracy or human
work saved. Results contain no invented confidence or professional certification.

## Verify and extend

```sh
pnpm --dir servers/qa-server type-check
pnpm --dir servers/qa-server lint
pnpm --dir servers/qa-server test:coverage
pnpm --dir servers/qa-server qualify --report /private/tmp/qa-scorecard.json
pnpm --dir servers/qa-server test:extraction
```

Build first. Tests exercise real generic MCP clients, private-file startup,
source authority, result restart, revocation and model failure without a live
provider key. Qualification checks 22 configured synthetic cases and writes
metadata only. Its detection scores apply to those labeled examples, with
professional acceptance false and reviewer effort unmeasured. Contributors can
refine the initial research-assisted labels through review.

See [how it works](docs/HOW_IT_WORKS.md), [architecture](docs/ARCHITECTURE.md),
[deployment](docs/DEPLOYMENT.md), [local testing](docs/LOCAL_TESTING.md), and
[development](docs/DEVELOPMENT.md) for the supported boundaries and checks.
