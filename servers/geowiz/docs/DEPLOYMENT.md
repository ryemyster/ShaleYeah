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

Then complete [private HTTP access setup](HTTP_ACCESS.md). Its configured local
launcher supplies a dedicated credential, scoped operator principal and audit
file, then binds to loopback. PORT alone fails before listening. Startup and
health need no model key; protected `/mcp` requests need the access credential.
Remote deployments inject verified identity and audit adapters through the SDK
and independently qualify TLS/issuer/hosting behavior.

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
| `PORT=3001` | HTTP transport only with explicit access configuration |
| `GEOWIZ_HTTP_CONFIG_FILE` | Private local-launch policy with credential/audit file references; see HTTP access setup |
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

The current Geologist Python wrapper needs #679's credential/destination client
before using this protected endpoint. Its imports/tests work independently;
the [generic-client test](HTTP_ACCESS.md#test-the-real-boundary-without-model-keys)
checks ingress now. Live providers, permitted sources and employee/task behavior
remain #669/#670/#671/#674; no model key grants tool authority.

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

Current no-key evidence includes the real generic-client ingress test and private
local launcher, plus shared session/schema/identity/scope regressions. Actual
source/professional cases, issuer/TLS deployment, protected review and employee
restart/restore still must pass before release support changes.
Record package and server versions separately, plus the actual runtime/model/
profile/image versions and limits. Follow [the MVP plan](../../../docs/mvp-release-plan.md).
