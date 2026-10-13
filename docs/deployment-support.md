# Portable execution and deployment support

Start with one employee and its tool server on a development machine. A
container image packages code and runtime dependencies for another host. The
deployment target is an independent, installable unit or a portable container;
cloud hosting is optional. Small datasets do not require Snowflake, a vector
database, a coordinator or Google Cloud.

This is the support decision from
[Issue #578](https://github.com/ryemyster/ShaleYeah/issues/578), inspected at
develop `3c17f6d2637dd1f6aeeb52bac513524e68542479` on 2026-10-08. It records
current commands and future qualification gates. The first reference is
Geologist plus Geowiz; it does not certify all fourteen employees or every file
format. Follow the [MVP plan](mvp-release-plan.md) for implementation order.

## Keep the choices separate

| Choice | Current reference | Replacement boundary |
| --- | --- | --- |
| Employee authoring framework | Python ADK (Google Agent Development Kit) | Job/task/evidence/context/review records in [contracts/](../contracts/README.md) do not depend on ADK |
| Model provider | Explicit Gemini/Anthropic profiles across Geologist reasoning and Geowiz formation synthesis | Native offline conformance and role/HITL fixtures pass; real-model/domain quality and hosted execution remain separate gates |
| Context and review storage | Geologist embedding runtime uses scoped SQLite catalog/native sessions; Geowiz uses a separate transactional review/finding store | Current grants, exact qualified human decisions, original expiry and durable state are required; development CLI sessions remain in memory |
| Protocol adapter | Python MCP (Model Context Protocol) client and TypeScript MCP server using Streamable HTTP; server also has a stdio launch mode | #668/#677/#678/#679 repair lifecycle, schemas/errors, identity and shared client handling; #674 tests composition |
| Hosting | Development workstation today | Local package/container minimum is the target; VM/Fly.io/Cloud Run/GKE/Agent Runtime remain optional adapters |

Geologist remains a **Stand-alone Agent with Progressive Disclosure (Skills)**.
This documentation issue uses **shared contract/process only**; selecting a
host does not change the employee mode, grant professional authority or add a
coordinator.

## Support matrix

**Verified** means the stated bounded checks ran, with the limits below.
**Planned** means required implementation/acceptance work has an owner.
**Untested** means no repository-specific deployment evidence is supplied.
Platform features do not turn an untested SHALE YEAH deployment into a verified one.

| Target | Repository status | State and ingress requirements | Evidence required before a support claim |
| --- | --- | --- | --- |
| Current checkout, local processes | **Verified, bounded:** locked packages, protected Geowiz connection and native ADK/SQLite restart/selection/recovery controls | Offline provider fixtures; trusted host/source callbacks and private persistent directory required; CLI development sessions remain in memory | Live complete employee/tool/review task and professional acceptance remain unqualified |
| Extracted local packages | **Verified, bounded:** exported source builds and installed employee/tool pair with public LAS, native offline providers, context and exact qualified review/resume | Explicit helper archives/wheels, locks and private authority/state; [reproduction](reference-packages.md) | Live/domain acceptance and other employees/formats remain separate |
| Portable containers | **Required CI qualification:** separate Geologist/Geowiz recipes and protected Linux fixture journey | Private actor-specific mounts, UID ownership, loopback network namespace, credential/audit/qualified review and persistent state | Support is limited to the architecture/image digests in a passing [container report](reference-packages.md); other networks/hosts require evidence |
| VM | **Untested** optional host | Supervised processes/containers, durable disk, TLS/private network, backup/restore | VM recipe and observed install/restart/permissions/resource checks on a named revision |
| Fly.io | **Untested** optional host | Declared app/image, mounted volume or external state, private connectivity; replication/backup explicit | Actual image/Machine/volume configuration and restart/restore/access tests; no tracked `fly.toml` today |
| Cloud Run | **Untested** optional host | Correct `PORT`/bind address; durable external state, authenticated ingress/service identity | Actual container/service/config, model/tool/source identity and revision/restart/export checks |
| GKE (Google Kubernetes Engine) | **Untested** optional host | Kubernetes manifests, persistent storage/claims, service identity, secret and network policy | Deployment/storage manifests and observed rolling restart/restore/isolation checks; no manifests today |
| Agent Runtime | **Untested** optional Google managed host | Target-specific deployment/identity and explicit session/context/review storage wiring | Supported adapter/SDK/image configuration and observed task/review/restart/export checks; manifest currently says `none` |

The [reference export and container guide](reference-packages.md) supplies tracked
separate unit recipes and required image/journey checks. No hosted manifests or
public image releases are supplied. Later role PRs prove their own units; source
shape, health or an unexecuted recipe cannot expand this matrix's support claims.

Reporter has its own [export and container qualification commands](reference-packages.md#reporter-employee-and-tools)
and required CI job. It handles reviewed business artifacts with current sharing
and separate evidence-metadata permissions. Its source/installed checks cover
source-backed native context and private publication review; container claims
require its own passing image/journey report. It does not expand the geological
raw-format or hosted-deployment support claims above.

## Run the current reference locally

These steps use a **checkout**, not an extracted package. Use synthetic fixtures
on a trusted development host. Geowiz HTTP requires explicit identity/scopes,
a dedicated access credential or verifier and an audit sink. The local example
binds to loopback with exact host/origin policy. #668 supplies session lifecycle and
[finite HTTP settings](../sdk/docs/DEPLOYMENT.md#environment-variables);
#678 supplies the configured ingress boundary. Actual issuer/TLS, source rights,
protected review and extraction/hosted qualification remain separate. The installed
[Python client](../sdk/python/README.md) resolves the dedicated credential reference,
checks results and bounds setup retries without replaying dispatched tools.

1. From the repository root, install locked TypeScript dependencies and build
   the shared SDK, then the tool. Node 22 is the CI baseline; use the repository's
   pinned pnpm version where available.

   ```bash
   pnpm install --frozen-lockfile
   pnpm --dir contracts build
   pnpm --dir connectors build
   pnpm --dir sdk build
   pnpm --dir servers/geowiz build
   ```

2. From `agents/geologist`, install its locked Python/eval dependencies and
   check the current project. Its `pyproject.toml` requires Python `>=3.11,<3.14`.

   ```bash
   uv sync --frozen --extra eval
   uv run --frozen pytest -q
   uv run --frozen python -c 'from app.agent import app, root_agent; print(app.name, root_agent.name)'
   agents-cli info
   ```

   Package checks include project/eval shapes and MCP contract regressions;
   they are not professional workflow evaluations. `agents-cli info` should identify this
   directory and show deployment target `none`. Current CLI 1.3.1 reports the
   manifest's scaffold version 0.5.1 mismatch; an upgrade is a reviewed adapter
   change, not permission to scaffold the repository root or deploy a service.

3. Complete [private HTTP access setup](../servers/geowiz/docs/HTTP_ACCESS.md)
   to create the local operator policy and dedicated credential outside the
   repository. In terminal A, from the repository root, start the configured tool
   on an unused port. Startup/health and the ingress fixture need no model key.

   ```bash
   PORT=3001 GEOWIZ_HTTP_CONFIG_FILE="$HOME/.config/shaleyeah/geowiz/access.json" \
     pnpm --dir servers/geowiz start:http
   ```

   In another terminal, check the same port:

   ```bash
   curl --fail http://127.0.0.1:3001/health
   ```

   Current response is `{"status":"ok","server":"geowiz","version":"1.0.0"}`.
   The SDK factory supplies that server version; Geowiz's package version is
   0.1.0. Record both rather than assuming health reports the package version.
   Stop your own server with Ctrl-C when done; do not stop another user's process
   to free a port. Omit `PORT` only when an MCP client manages a stdio child.

4. Complete [model provider configuration](model-providers.md) with owned private
   profiles and dedicated key references. Geologist reasoning and Geowiz formation
   synthesis support Gemini and Anthropic and require the same production provider.
   Geowiz's HTTP policy uses `modelConfigFile`; Geologist uses
   `GEOLOGIST_MODEL_CONFIG_FILE`. A no-key import/health check does not qualify a model.

   From `agents/geologist`, use the same private credential file as the backend,
   with its permitted scopes and the separate model credentials ready:

   ```bash
   GEOLOGIST_MODEL_CONFIG_FILE=/absolute/private/models.json \
   GEOWIZ_MCP_URL=http://127.0.0.1:3001/mcp \
  GEOWIZ_MCP_ACCESS_TOKEN_FILE="$HOME/.config/shaleyeah/geowiz/credential" agents-cli run \
     "Use assess_geowiz_quality on tests/sample-files/sample.las as LAS data"
   ```

   That fixture path resolves on the **Geowiz** host relative to its working
   directory, not on the employee host. This command is a live-task example,
   unqualified by #578; actual provider, MCP/tool and source checks belong to
   #674. The [LAS review baseline](../servers/geowiz/docs/LAS_REVIEW.md) covers
   deterministic inputs and missing-evidence behavior. Complete [private source setup](../servers/geowiz/docs/DATA_SOURCES.md).
   Never embed a real key in a command, prompt or JSON example.

5. Optional manual playground, still from `agents/geologist`:

   ```bash
   agents-cli playground --host 127.0.0.1 --port 8000
   ```

   This is an explicit development UI port. `agents-cli run` manages its own
   local server; Geologist has no fixed production port 4001. The CLI's
   `--start-server`/`--session-id` preserve an in-memory session only while the
   server survives. They do not implement durable employee review/resume.

## Configuration, files and authority

| Unit | Actual settings / paths | What must survive deployment |
| --- | --- | --- |
| Geologist | `GEOLOGIST_MODEL_CONFIG_FILE` requires a fixed trusted profile; `GEOWIZ_MCP_URL` defaults to `http://127.0.0.1:3001/mcp`; provider credentials as above | Qualified provider/model/profile versions, permitted source/task identity, context revisions and human review; #672/#673 |
| Geowiz | `PORT` plus explicit `http.access` selects protected HTTP; private local example uses `GEOWIZ_HTTP_CONFIG_FILE`; optional `eventConfigFile` adds [correlated local metadata](employee-events.md); unset PORT selects stdio; model key is separate | #678 supplies ingress; source grants/byte provenance use [connectors/](../connectors/README.md); review and actual remote issuer/TLS remain #673/#674 |
| Geowiz files | Approved findings/review/audit/outcomes use the private configured `review.sqlite`; file-tool caller `outputPath` writes are denied | Keep current owned review/source state and original retention on explicit mounts; [source setup](../servers/geowiz/docs/DATA_SOURCES.md) and [container proof](reference-packages.md) |
| Current sessions | Development manifest `session_type: in_memory`; [embedding runtime](../agents/geologist/docs/WORKING_CONTEXT.md) provides scoped native ADK/SQLite context | One native writer, fresh authority callbacks, private persistent directory and original-expiry recovery; protected review remains #673 |

`DATA_PATH` and `LOG_LEVEL` are not read by this reference implementation.
Setting them does not relocate findings or redact logs. ADK confirmation protects
the agent's save tool interaction; it does not authorize a direct MCP caller.
Backend enforcement and durable audit must pass before consequential use. Model
prose and a host identity cannot approve geological work or promote memory.

For containers, a file path belongs to the tool container. Mount approved inputs
read-only there and retained output/state on explicit writable volumes. Use a
reachable, qualified service URL for your network. The shipped local fixture
shares the tool's private network namespace, so loopback addresses refer to that
same namespace. It publishes no host port. A separate network/remote host needs
its own qualified listener/ingress setup. See [exact mounts and proof](reference-packages.md).

## Durable state, recovery and resource qualification

The required local default is durable, scoped state outside disposable processes
and images. It must work on modest infrastructure without a warehouse or vector
database. Geologist's [local adapter](../agents/geologist/docs/WORKING_CONTEXT.md)
implements scoped retained context; #673 owns protected review/resume. ADK
session storage is a separate adapter: its
[DatabaseSessionService](https://adk.dev/sessions/session/)
can persist sessions, but that alone does not implement reviewed context or
authority. Use the embedding API with its trusted callbacks; a state-URL flag
alone does not enable those checks.

Before qualifying an extracted package/container in #674:

1. Record the actual state/artifact/source locations, schema versions, owner and
   retention policy. Test read-only inputs, denied/cross-asset paths and volume
   ownership. Missing durable storage must fail readiness for resumed work.
2. Stop and restart between draft, review and resume. Preserve evidence and exact
   approved revisions; changed inputs invalidate the previous approval. Never
   reconstruct approval from chat history or a model statement.
3. Export scoped context, work products and review/audit records without secrets.
   Back up consistently with the selected store; restore to a fresh runtime and
   verify checksums/revisions/access and prevent replay of already executed actions.
   Scoped context export/restore is implemented by the embedding API; the
   complete review/action recovery journey remains #673/#674. JSON finding copies alone do not
   back up an employee workflow.
4. Record minimum tested CPU/RAM/disk, source sizes and request concurrency from
   real input, restart and load tests. Include cold start, peak resident memory,
   artifact/temp storage, timeouts, cancellation and disk-full failure. No 256MB
   production budget or horizontal-scaling guarantee is established today.

Historical #578 development evidence: macOS 26.6.2 arm64, Node 26.10.0, pnpm 11.5.1,
uv 0.12.21, Python 3.12.13, ADK 2.4.0 and Python MCP 1.28.1. One offline agent
import took 0.99 seconds and 127,778,816 bytes maximum resident memory using
`/usr/bin/time -l`; that is a single import measurement, **not a deployment
capacity/minimum**. Existing CI uses Node 22/Python 3.12; no Linux image or load
measurement is supplied by this issue. Pin dependencies/images and record the
actual model/profile/SDK versions in qualification receipts.

#722 selects the newer stateless MCP profile and owns fresh client, installed
package and container receipts. The older import measurement above remains a
historical observation and is not relabeled as modern protocol qualification.

Geowiz's existing package tests also passed, but some processor checks use
placeholder structures or mock validation, including a known seismic-parser
failure. Their printed coverage/production claims are not qualification evidence.
#671 replaces the initial LAS guesses with source-linked input review; #674 verifies
the supported reference journey with actual inputs and outputs.

## Optional host requirements

- **VM:** use a supervised service, least-privilege runtime identity, private
  ingress/TLS, persistent disk and tested restore. Apply the same employee/tool
  contract as containers; no VM-specific logic belongs in agent reasoning.
- **Fly.io:** volumes are tied to a Machine/server and do not automatically
  replicate; snapshots do not replace application backup/restore. Choose explicit
  state ownership/replication before adding replicas.
  [Fly volume documentation](https://docs.fly.io/volumes/overview).
- **Cloud Run:** the ingress container listens on `0.0.0.0` at the supplied
  `PORT`; its ordinary writable filesystem is in memory and is lost when the
  instance stops. Wire durable storage and authenticated ingress/service access;
  automatic scaling cannot make process-local sessions/review durable.
  [Cloud Run runtime contract](https://docs.cloud.google.com/run/docs/container-contract).
- **GKE:** explicit PersistentVolumes/PersistentVolumeClaims and reclaim policy
  define storage lifecycle; configure service identity, secrets and network
  policy separately. A Kubernetes deployment does not prove application restore.
  [Kubernetes persistent volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/).
- **Agent Runtime:** use a qualified target adapter and explicit managed session
  wiring; managed sessions do not substitute for employee context/review policy.
  Current project target remains `none`.
  [ADK deployment](https://adk.dev/deploy/agent-runtime/),
  [managed sessions with ADK](https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/sessions/manage-with-adk).

Those are platform requirements, checked against primary documentation on
2026-10-08, not hosted deployment receipts. Vendor SDK/product names and storage
APIs may change; record the qualified adapter version when a host is added.
Current Gemini credential behavior is documented by
[Google AI](https://ai.google.dev/gemini-api/docs/api-key).

## Evidence needed to change a status

Every qualification receipt names the source commit, packages/locks, image
digests if applicable, host/architecture, commands, identity/source policy,
provider/model/profile versions, inputs, results and remaining limits. Required
cases are the small local journey (**control**), missing keys/storage, restart and
unsupported host (**edge**), and source/task/review bypass (**authority boundary**).
Use deterministic checks for contracts/trust, domain experts for geological
correctness and optional configured LLM rubric scores separately.

Require [ADR 0004's composition cases](../contracts/docs/0004-composition-conformance.md)
and a generic MCP client in #674; job evaluations/promotion gates are #666/#667/#577.
#693 reconciles the exact candidate support matrix and #694 records human MVP
acceptance before #695 promotes develop to main. A closed documentation issue,
healthy port or successful import does not replace those gates.
