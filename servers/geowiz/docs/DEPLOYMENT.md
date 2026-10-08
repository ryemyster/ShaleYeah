# Running and deploying Geowiz

Geowiz is a TypeScript MCP (Model Context Protocol) tool server. It runs separately
from the Python Geologist employee. Follow the [portable execution guide](../../../docs/deployment-support.md)
for current evidence and the ordered pair setup.

## Build and start in the checkout

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --dir sdk build
pnpm --dir servers/geowiz build
```

Then from `servers/geowiz`, on a trusted private development host:

```bash
PORT=3001 pnpm start
```

Startup and health need no model key. The current HTTP server has no
authenticated tool-entry gate and binds without a host restriction; keep it off
public/shared ingress until #678's identity/scopes and #668's session lifecycle
are qualified.

```bash
curl --fail http://127.0.0.1:3001/health
```

Current response:

```json
{"status":"ok","server":"geowiz","version":"1.0.0"}
```

The SDK factory supplies that server version; the package version is 0.1.0.
A healthy port proves startup, not tool schemas, client isolation, professional
results or authorized persistence. Use an unused port; stop only your own
process with Ctrl-C.

## Transport and actual settings

| Setting | Actual behavior |
| --- | --- |
| `PORT` unset | stdio transport, managed as a child process by an MCP client |
| `PORT=3001` | HTTP transport on that port; use a positive unused port |
| `ANTHROPIC_API_KEY` | Required for real model-assisted analysis; not for startup/health or deterministic quality checks |
| Storage | SDK defaults to `./data/geowiz`; findings go to `./data/geowiz/findings` relative to working directory |
| Input / output paths | Resolved on the Geowiz host; some tools write caller-supplied `outputPath` |

`DATA_PATH` and `LOG_LEVEL` are not implemented environment settings here.
Setting them does not relocate persisted files, change log level or redact
outputs. Source/output-root controls and audit/redaction are #670/#678/#574.

Provider credentials must be injected through secret references outside prompts
and command history. Geologist's Gemini credential is separate from Geowiz's
Anthropic credential; #669 implements the reference's BYO provider contract.

## Use with the employee

With this tool running privately and the selected employee model configured,
run from `agents/geologist`:

```bash
GEOWIZ_MCP_URL=http://127.0.0.1:3001 agents-cli run \
  "Use assess_geowiz_quality on tests/sample-files/sample.las as LAS data"
```

That path points to this package's synthetic fixture. For a remote/container
tool, make the approved inputs accessible on the tool host. A natural-language
task and every advertised format remain subject to #669/#671/#674 qualification.

## Persistence, containers and scaling

Geowiz holds HTTP session state and writes findings/artifacts. It is not
stateless infrastructure. Multiple clients/replicas require #668 isolation,
declared storage/concurrency and backend review enforcement; a load balancer
alone supplies none of those.

There is no tracked Geowiz Dockerfile, Compose recipe or published-image receipt
at the inspected baseline. #674 owns installable SDK dependencies and the real
reference image/network/mount recipes. This package currently declares
`workspace:*` SDK and a parent-relative test runner, so copying its folder or
installing its package.json alone does not prove extraction.

The portable container contract requires locked builds, explicit read-only
source and persistent output/state mounts, private networking, executing
identity/scopes, redacted audit and restart/restore tests. Do not publish a
floating-image, fixed 256MB budget or Kong/cloud recipe as certified support
without those results. See the [host matrix](../../../docs/deployment-support.md#support-matrix)
for optional VM/Fly.io/Cloud Run/GKE/Agent Runtime status.

JSON findings are not employee review/context backups. #672/#673 implement
durable employee state and exact-revision continuation; #674 verifies the pair.

## Verification

Current no-key evidence covers build/start/health. Generic-client tool
handshake/results, source/professional cases, identity/review denial, client
isolation, cancellation and restart/restore must pass before changing support.
Record package and server versions separately, plus the actual runtime/model/
profile/image versions and limits. Follow [the MVP plan](../../../docs/mvp-release-plan.md).
