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
| Model provider | Geologist selects a Gemini model; Geowiz model-assisted tools use the shared Anthropic client | #669 implements reference provider configuration across both processes; a key switch alone is not BYO-agent support |
| Context and review storage | Geologist manifest declares in-memory sessions; Geowiz writes JSON findings to disk | #672/#673 implement scoped durable context and exact-revision review/resume; session storage alone is insufficient |
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
| Current checkout, local processes | **Verified, bounded:** locked Geologist install/import, 11 existing shape tests, SDK/Geowiz builds and no-key Geowiz HTTP startup/health | Test data only; current agent sessions are in memory and MCP entry has no authenticated gate | Live employee/tool task, failures, review/restart and professional cases remain unqualified |
| Extracted local packages | **Planned**, #674 and each role PR | Declared installed dependencies, package-local checks and local durable state; no root source/test-runner lookup | Clean install/run/check outside checkout, independent agent/MCP, compatible external client/tool, exact supported inputs |
| Portable containers | **Planned**, #674 | Separate employee/tool images; external config/secrets; persistent state/artifacts; restricted ingress and authenticated tool entry | Reproducible image build/digests, locked dependencies, mounts/ownership, restart/restore and all reference acceptance cases |
| VM | **Untested** optional host | Supervised processes/containers, durable disk, TLS/private network, backup/restore | VM recipe and observed install/restart/permissions/resource checks on a named revision |
| Fly.io | **Untested** optional host | Declared app/image, mounted volume or external state, private connectivity; replication/backup explicit | Actual image/Machine/volume configuration and restart/restore/access tests; no tracked `fly.toml` today |
| Cloud Run | **Untested** optional host | Correct `PORT`/bind address; durable external state, authenticated ingress/service identity | Actual container/service/config, model/tool/source identity and revision/restart/export checks |
| GKE (Google Kubernetes Engine) | **Untested** optional host | Kubernetes manifests, persistent storage/claims, service identity, secret and network policy | Deployment/storage manifests and observed rolling restart/restore/isolation checks; no manifests today |
| Agent Runtime | **Untested** optional Google managed host | Target-specific deployment/identity and explicit session/context/review storage wiring | Supported adapter/SDK/image configuration and observed task/review/restart/export checks; manifest currently says `none` |

There are no tracked Dockerfiles, Compose recipes, hosting manifests or built
reference-image evidence at this snapshot. Old inline Docker/Compose snippets
were examples, not buildable packages. #674 supplies the actual first recipes;
later role PRs prove their own units. Other deployment pages must not be used to
infer qualification beyond this matrix.

## Run the current reference locally

These steps use a **checkout**, not an extracted package. Use synthetic fixtures
on a trusted development host. Current Geowiz HTTP startup binds without an
explicit host restriction and has no authenticated MCP entry; keep it off public
or shared ingress. #678 implements executing identity/scopes, and #668 fixes
session isolation. A health response does not prove either property.

1. From the repository root, install locked TypeScript dependencies and build
   the shared SDK, then the tool. Node 22 is the CI baseline; use the repository's
   pinned pnpm version where available.

   ```bash
   pnpm install --frozen-lockfile
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

   The package has eleven project/tool/eval **shape** checks, not eleven
   professional workflow evaluations. `agents-cli info` should identify this
   directory and show deployment target `none`. Current CLI 1.3.1 reports the
   manifest's scaffold version 0.5.1 mismatch; an upgrade is a reviewed adapter
   change, not permission to scaffold the repository root or deploy a service.

3. In terminal A, from `servers/geowiz`, start the tool on an unused private
   development port. Startup and health do not need a model key.

   ```bash
   PORT=3001 pnpm start
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

4. For a natural-language task, configure the chosen model's credentials in
   the process environment through a secret reference or local secret loader.
   Current default Gemini runs use `GOOGLE_API_KEY` or `GEMINI_API_KEY`; a selected
   Vertex backend requires its own configured project/identity. Geowiz's
   model-assisted tools separately use `ANTHROPIC_API_KEY`. A credential-free
   import/health check does not validate either provider.

   From `agents/geologist`, with the backend still running:

   ```bash
   GEOWIZ_MCP_URL=http://127.0.0.1:3001 agents-cli run \
     "Use assess_geowiz_quality on tests/sample-files/sample.las as LAS data"
   ```

   That fixture path resolves on the **Geowiz** host relative to its working
   directory, not on the employee host. This command is a live-task example,
   unqualified by #578; actual provider, MCP/tool and source checks belong to
   #669/#670/#671/#674. Never embed a real key in a command, prompt or JSON example.

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
| Geologist | `GEOLOGIST_ADK_MODEL` defaults to `gemini-flash-latest`; `GEOWIZ_MCP_URL` defaults to `http://localhost:3001`; provider credentials as above | Qualified provider/model/profile versions, permitted source/task identity, context revisions and human review; #669/#672/#673 |
| Geowiz | `PORT` selects HTTP; unset selects stdio; Anthropic key for model-assisted tools | Tool identity/scopes, source access, review enforcement, redacted durable audit; #678/#673/#574 |
| Geowiz files | SDK default `./data/geowiz`; `save_finding` writes `./data/geowiz/findings/<id>.json`; some tools also write caller `outputPath` | Mount the actual configured working-directory paths, restrict source/output roots and preserve ownership; #670/#678/#674 |
| Current sessions | Geologist manifest `session_type: in_memory`; no package-configured persistent context/review store | Restart-safe scoped context, approval/revision invalidation and export/delete/restore; #672/#673 |

`DATA_PATH` and `LOG_LEVEL` are not read by this reference implementation.
Setting them does not relocate findings or redact logs. ADK confirmation protects
the agent's save tool interaction; it does not authorize a direct MCP caller.
Backend enforcement and durable audit must pass before consequential use. Model
prose and a host identity cannot approve geological work or promote memory.

For containers, a file path belongs to the tool container. Mount approved inputs
read-only there and retained output/state on explicit writable volumes. Use a
reachable service URL such as `http://geowiz:3001` on a private container network,
not `localhost` for another container. Those mounts/network names are the
**acceptance contract**, not a shipped Compose file.

## Durable state, recovery and resource qualification

The required local default is durable, scoped state outside disposable processes
and images. It must work on modest infrastructure without a warehouse or vector
database. #672 selects/implements context storage; #673 owns review/resume. ADK
session storage is a separate adapter: its
[DatabaseSessionService](https://adk.dev/sessions/session/)
can persist sessions, but that alone does not implement reviewed context or
authority. No state-URL flag in this guide claims to enable those missing features.

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
   The current package has no complete context/review export/restore command;
   #672/#673 implement it and #674 verifies it. JSON finding copies alone do not
   back up an employee workflow.
4. Record minimum tested CPU/RAM/disk, source sizes and request concurrency from
   real input, restart and load tests. Include cold start, peak resident memory,
   artifact/temp storage, timeouts, cancellation and disk-full failure. No 256MB
   production budget or horizontal-scaling guarantee is established today.

Observed development evidence: macOS 26.6.2 arm64, Node 26.10.0, pnpm 11.5.1,
uv 0.12.21, Python 3.12.13, ADK 2.4.0 and Python MCP 1.28.1. One offline agent
import took 0.99 seconds and 127,778,816 bytes maximum resident memory using
`/usr/bin/time -l`; that is a single import measurement, **not a deployment
capacity/minimum**. Existing CI uses Node 22/Python 3.12; no Linux image or load
measurement is supplied by this issue. Pin dependencies/images and record the
actual model/profile/SDK versions in qualification receipts.

Geowiz's existing package tests also passed, but some processor checks use
placeholder structures or mock validation, including a known seismic-parser
failure. Their printed coverage/production claims are not qualification evidence.
#671 owns source-specific results and unsupported-format failures; #674 verifies
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
