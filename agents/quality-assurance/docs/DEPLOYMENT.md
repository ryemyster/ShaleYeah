# Install and connect QA

Run the employee and QA tool server separately. The employee needs Python 3.12,
its declared wheels and a privately configured model/provider. The server needs
Node 22 or newer, its declared archives, private source/rule settings and explicit
transport access policy. For protected disposition approval it also installs the
portable evaluation verifier; it does not install the employee brain.

For local development use `uv sync --locked` and `agents-cli run` from the employee
package. Configure `QA_EMPLOYEE_MODEL_CONFIG_FILE`, `QA_SERVER_MCP_URL` and
`QA_SERVER_MCP_ACCESS_TOKEN_FILE` as described in the README. The host opens
`QARuntime` with its own `ContextCatalog`, model configuration and backend adapter.
A local operator, compatible external agent or another deployment can use the
same server tools over MCP.

The server's `QA_CONFIG_FILE` contains the current canonical task, approved and
sealed rule profile, source snapshots with actual bytes, scoped current grants,
a private results directory and metadata-only audit sink. Its optional `review`
section adds the separate review/disposition policies, enrolled local reviewer
and trusted qualification configuration. The separately enrolled operator uses:

```bash
node examples/review.mjs inspect REVIEW_ID NEW_PRIVATE_PACKET_FILE
node examples/review.mjs decide REVIEW_ID PACKET_DIGEST \
  approve PRIVATE_REASON_JSON
```

The model never receives that interface's human credentials. Approving a bounded
exception does not change the observed result or authorize data repair, external
publication or a company-wide release. A request for changes requires a new exact
work revision. Production hosts can inject current enterprise source/identity
providers instead of attested local exports.

Operators may supply normalized exports from internal systems or openly licensed
datasets. They must retain actual source hash/revision, scope, usage policy,
provenance, units and current read/export rights. File fixtures do not prove a live
third-party connector or permission to redistribute data. Native context references
must use the canonical content-addressed source artifact identity.

Build the employee wheel with `uv build --wheel`. For a clean export, remove the
local `tool.uv.sources` authoring overrides and install declared helper wheels.
The server's extraction checker creates independent source and production archive
installations and tests actual protected native journeys outside the checkout:

```bash
node servers/qa-server/scripts/check-extraction.mjs \
  --bundle /absolute/empty/qa-bundle --report /absolute/qa-extraction.json
```

Separate employee and tool Dockerfiles install hash-locked production dependencies
and run as non-root users. Containers, VMs and other Python/Node hosts use the
same configuration boundaries. No cloud project or warehouse is required.
