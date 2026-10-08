# Employee contracts

This package describes an employee's job, assigned work, evidence, context and
human review. An employee can be a SHALE YEAH specialist or an externally supplied
agent. The same records work in Python and TypeScript without an agent framework,
model client, MCP client, database or coordinator.

The source of truth is
[employee-0.1.0.schema.json](shaleyeah_contracts/schemas/employee-0.1.0.schema.json),
a JSON Schema 2020-12 document. Both validators read it. TypeScript declarations
are generated from it; Python uses ordinary dictionaries validated at the boundary.
The [fixtures](fixtures/records.json) contain synthetic Geologist examples, including
zero confidence, unknown porosity, blocked work, a replacement employee and review
decisions. They are format examples, not qualified geological findings.

[ADR 0002](docs/0002-context-lifecycle.md) specifies private employee context,
reviewed sharing, selection budgets, compaction, invalidation and export/deletion.
Its [synthetic examples](fixtures/context-lifecycle.json) use the same 0.1.0
records. Tests validate example shapes and reference binding; the sixteen expected
policy scenarios are acceptance specifications for #672/#673, not an implemented
authorization/retrieval service.

## Install and use

Installation metadata permits Node 22 or newer for TypeScript and Python
3.11–3.14 for Python. Local checks use Node 26 and Python 3.12; CI uses Node 22
and Python 3.12. Other version combinations need qualification before a release
claims them as verified. These packages are built locally; they have not been
published to npm or PyPI.

From this directory:

```sh
pnpm install
pnpm build
pnpm test:ts
uv sync --locked
uv run --locked pytest --cov=shaleyeah_contracts --cov-fail-under=90
pnpm lint
pnpm check:isolation
```

After copying this directory to another repository, the same commands work
without the SHALE YEAH root config or SDK. In that separate repository, pnpm
creates its own lockfile; this monorepo uses the workspace lockfile. Python has
its own committed `uv.lock`.

TypeScript:

```typescript
import { validateContract, type EmployeeContract } from "@shaleyeah/contracts";

const employeeRecord: EmployeeContract = validateContract(untrustedJson, {
  expectedScope: currentScope,
  expectedTaskRevision: currentTaskRevision,
  expectedProductRef: currentProductRef,
});
```

Python, installed from this directory or a built wheel:

```python
from shaleyeah_contracts import validate_contract

employee_record = validate_contract(untrusted_json, {
    "expectedScope": current_scope,
    "expectedTaskRevision": current_task_revision,
    "expectedProductRef": current_product_ref,
})
```

The three expectation options are optional, independent comparisons. Supply
only those relevant to the record. `expectedScope` contains customer, asset,
task and employee IDs. `expectedProductRef` contains the artifact ID, revision
and URI. They must come from the caller's current assignment/review state.
Validation returns the supplied record unchanged or raises
`ContractValidationError`, with a stable `code` and value-free `issues`.
Consumers should branch on the code; diagnostic paths/order are not a shared
cross-language wire format.

For a charter, callers can supply `trustedAuthority`: employee ID, customer ID,
allowed capabilities and an authority-policy ID/version. The validator compares
the charter with that separate policy, rejects extra capability claims and checks
the policy's shape. A caller must obtain this policy through a trusted boundary.
Supplying a model's own policy claims would defeat the comparison.

## Records and invariants

| Kind | Purpose | Required boundary |
| --- | --- | --- |
| `employee-charter` | Job, human owner, responsibilities, non-goals, inputs/outputs and policy/eval references | Stable employee ID, business role and capability IDs are separate from Roman display names; all four context-isolation dimensions are declared |
| `task-assignment` | Outcome, inputs, constraints, required capabilities and status | Customer/asset/task/employee scope; task ID matches its scope; completed work references a product |
| `work-product` | Inputs, findings, evidence, assumptions, uncertainty, blockers and review state | Artifact/task revisions; ready/final work has inputs, evidence and findings; final work references approval; blocked/failed work declares blockers |
| `context-manifest` | Selected evidence, private work and reviewed shared knowledge | Scope/task revision, policy, item/byte/token limits and retention expiry; assembly precedes expiry; listed items fit the item budget |
| `review-request` | Decision requested for a specific work product | Scope/task revision, exact artifact ID/revision/URI and reviewer-policy reference |
| `review-decision` | Human decision, reason and audit reference | Reviewer identity/policy references and exact request/product/task revisions |

Evidence records carry source URI, SHA-256 content hash, revision, as-of time,
access classification and usage-policy reference. A hash is a declared value;
validation does not retrieve content or verify that value. Findings include
units, using `not_applicable` when a unit does not apply. Measured findings need
evidence; assumed findings need a declared assumption; unknown findings have a
null value and a reason. Every internal evidence/assumption reference resolves
within the work product, and IDs within each collection are unique. Confidence
is optional and ranges from 0 through 1; zero stays zero.

Shared knowledge includes its origin scope, evidence, usage/retention policy
and review-decision reference. Cross-customer sharing is rejected by this profile.
Explicit same-customer cross-employee/task/asset references describe a proposed
handoff; trusted retrieval and promotion policy must decide whether to use them.

Dates use RFC 3339 with a time zone and at most millisecond precision to avoid
different chronological results between Python and JavaScript. Closed objects
reject undeclared fields, including framework session state and credential
fields. Non-JSON values, malformed dates/URIs, unknown kinds/enums, and absent
required fields fail rather than gaining silent defaults.

## Versions and compatibility

Every record declares exactly `contractVersion: "0.1.0"`. Package versions track
schema releases. Artifact/task revisions, policy versions and eval-profile
versions are separate; changing an input or work product is not a schema upgrade.

| Change | Rule |
| --- | --- |
| Populate/omit an already declared optional field such as aliases | Compatible within 0.1.0; fixtures cover both |
| Documentation or binding repair that preserves accepted values and meaning | Patch release; regenerate and rerun parity |
| Add a new optional field | Structurally additive, but closed old validators reject it; publish a new schema version and require explicit consumer support before sending it |
| Add required fields, remove/rename fields, change units/meaning or accepted enums | Breaking; publish a new version, migrate consumers explicitly and retain old fixtures during any supported transition |

Before 1.0, contract changes use a new minor version; from 1.0 onward, breaking
changes use a new major version. This implementation supports only 0.1.0.
Any other supplied string version fails with `unsupported_version`; there is no
automatic downgrade, coercion or latest-version selection. A missing/non-string
version is an invalid contract.

To change the schema: add failing shared cases first, edit the canonical JSON,
run `pnpm generate`, then run build, lint and both test suites. The generation
check rejects stale declarations. Generation mechanically wraps the definitions
to emit unused option/policy types too; it defines no second business model.
Generated types describe field shapes; conditional and reference rules still
require runtime validation.

## Trust, adoption and verification limits

This library performs structural validation and explicit caller comparisons.
It cannot authenticate a reviewer, establish policy provenance, verify a
referenced approval, authorize a tool call, check source rights, enforce actual
byte/token use, redact secrets embedded in free text, or implement durable
context/review/resume. Do not treat a valid `approved` field as permission to act.
The authenticated trust design is #573; context policy/storage is #571/#672;
review binding and continuation are #673; connector behavior is #670. Evaluation
profiles/results are #666/#667. These contracts currently reference eval profiles.

Existing `sdk/src/contracts.ts` describes TypeScript runtime/tool configuration;
`sdk/src/canonical-model.ts` describes calculation inputs/results. Neither defines
these six employee records. Their existing callers remain while #576 inventories
them and #541/#542/#680/#681 migrate the remaining TypeScript employees; #692
removes accepted displaced helpers. New employee boundaries consume this package
rather than copying ad hoc Python/TypeScript schemas.

`pnpm test` runs identical shared valid/invalid fixtures in both languages with
a 90% minimum line-coverage gate. CI checks generation drift, build, lint, both
suites and isolated installation. `pnpm check:isolation` builds an npm archive and
Python wheel, installs each into a temporary outside consumer and validates a
record there. It does not deploy an employee or certify professional performance.
The isolation script requires bash on Linux/macOS. Native Windows packaging
verification remains part of #578/#674's support and extraction work.

The implementations use [Ajv's 2020-12 validator](https://ajv.js.org/json-schema.html)
and [Python jsonschema with format checks](https://python-jsonschema.readthedocs.io/en/stable/validate/);
[json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript)
generates the declarations. Runtime validation remains authoritative.

Apache 2.0; see [LICENSE](LICENSE).
