# Independent reference packages and containers

Geologist is the employee that reviews geological inputs. Geowiz is its tool
server, reached through MCP (Model Context Protocol). They can run as separate
installed units. This guide covers the bounded reference proof, using public LAS
files and offline provider fixtures. Live models and professional conclusions
still need their own evaluations and human acceptance.

## Export and test the units

From the checkout, supply a new empty directory outside your customer data:

```sh
pnpm --dir servers/geowiz exec node scripts/check-extraction.mjs \
  --bundle /tmp/shale-reference-bundle \
  --report /tmp/reference-extraction.json
```

The command builds declared dependencies, produces npm archives and Python
wheels, and creates two clean environments. It builds Geologist from exported
source without authoring workspace paths, and builds/tests exported Geowiz source
with explicitly supplied helper archives. The installed pair then runs outside
the checkout. The result file contains versions/hashes and outcomes, not raw
sources, prompts or credentials. A nonempty destination is rejected. Omitting
`--bundle` uses a temporary directory that is cleaned after the test.

| Bundle item | Use |
| --- | --- |
| `npm/` | Geowiz and its declared SDK, contract and connector archives |
| `wheels/` | Geologist, portable contracts, evaluations and MCP client |
| `requirements-employee.txt`, `requirements-tool.txt` | Locked Python dependency versions and hashes |
| `source/geowiz/` | Independently buildable source with local tests, configuration and explicit `vendor/` archives |
| `source/geologist/` | Python source, reviewed reference assets, build metadata and license; no root editable-source paths |
| `tool/package-lock.json` | Resolved npm dependencies/integrity, using the supplied archives |
| `recipes/` | Separate employee/tool container build recipes |
| `manifest.json` | Tested code revision, unit artifact hashes, lock hashes and fixture outcomes |

Geowiz production archives contain built code, launch/review entrypoints and
license, while its source export retains build/test files. Geologist's wheel
contains its persona/runtime plus `app/reference/` scorecard, dataset, approved
qualification policy and frozen baseline. It carries no customer state or keys.
The exporter checks archive allowlists; images copy only runtime dependencies.
Registry publication is separate: these commands do not publish npm, PyPI or
container releases.

## Install or rebuild an extracted unit

Install the supplied helper archives into the tool environment; avoid links back
to SDK source. The exported Geowiz source contains its three helper archives and
package-owned TypeScript settings:

```sh
cd /tmp/shale-reference-bundle/source/geowiz
npm ci --ignore-scripts --no-audit --no-fund
npm run build
GEOWIZ_TEST_PYTHON=/tmp/shale-reference-bundle/tool/.venv/bin/python npm test
```

`GEOWIZ_TEST_PYTHON` selects the independently installed portable verifier for the
review tests. It requires evaluation 0.3.0 and contracts 0.3.0, not the agent/ADK.
The authoring checkout has a uv convenience fallback; extracted tests use this
explicit interpreter. The exporter acceptance command belongs in the authoring
workspace, so the generated single-tool source removes `test:extraction`.

Build the exported employee with `uv build --wheel` from `source/geologist`.
Install its locked third-party requirements with hash checking, then install the
supplied first-party wheels with `--no-deps`. Run `pip check`/`uv pip check` to
verify declared versions. No path to another agent, orchestrator or warehouse is
required. Its native runtime, scoped context and deterministic review supervisor
remain embedding APIs; importing the package does not run a job.

Use [private HTTP settings](../servers/geowiz/docs/HTTP_ACCESS.md),
[source grants](../servers/geowiz/docs/DATA_SOURCES.md),
[context authority](../agents/geologist/docs/WORKING_CONTEXT.md) and
[human review/qualification](../servers/geowiz/docs/HUMAN_REVIEW.md) for real work.
Credentials are file/service references supplied by the operator. An installed
package, successful import or provider key does not grant source or save rights.

## Verify separate containers

The controller reads both container log streams for startup readiness; MCP
diagnostics use stderr. Structured Docker command results remain stdout-only.

On a Linux host with Docker, run from the checkout after the export succeeds:

```sh
uv run --project evaluations --locked python servers/geowiz/scripts/check-containers.py \
  --bundle /tmp/shale-reference-bundle --report /tmp/reference-containers.json
```

The harness resolves Python 3.12 and Node 22 base tags to immutable digests and
passes those digests into the recipes. The report records bases, built image IDs,
architecture, declared user, code revision, artifact/lock hashes and actual
outcomes. Missing Docker, failed builds or failed behavior block; they are never
skipped. Required reference CI runs this exact command and publishes metadata.

The worker runs in its own Python image, using its own writable context volume.
The tool image contains Node and the portable Python qualification verifier; it
does not contain the employee. Defaults use UID/GID 10001. The fixture harness
explicitly matches host IDs to private 0700/0600 mounts, drops capabilities, uses
read-only roots and supplies a bounded temporary directory. Account/volume
ownership must be configured for your deployment.

The local tool listener binds to loopback. The harness joins the worker to the
tool's private network namespace, publishes no host port and authenticates every
MCP request. A separate-network or remotely hosted deployment must supply its own
qualified ingress/listener configuration. The worker sees its MCP/agent key files
and task metadata; reviewer settings, synthesis keys and review store stay on the
operator/tool side. No Docker socket or approval endpoint is supplied to it.

The operator performs fixture approval through a separate `docker exec` CLI.
The harness verifies missing qualification blocks approval, then creates explicit
fixture evidence, approves the exact packet, restarts the tool, and starts a fresh
worker process to recover native context and resume exactly once. It repeats for
Gemini/Anthropic native offline transports and verifies source revocation blocks
access. These synthetic operator decisions are technical checks, not observed
human MVP acceptance or measured geological accuracy.

Only the Linux architecture recorded in a passing container report is qualified.
Other architectures, Windows, replicas, old-store rollback, external-write
transactions, remote IAM/TLS and VM/Fly.io/Cloud Run/GKE/Agent Runtime deployments
need their own evidence. The reference accepts source-backed LAS for analysis;
other advertised formats remain declined or unqualified. See the
[support matrix](deployment-support.md) and [release gates](mvp-release-plan.md).
