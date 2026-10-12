# Running and deploying Geowiz

Geowiz is a TypeScript MCP (Model Context Protocol) tool server. It runs separately
from the Python Geologist employee. Follow the [portable execution guide](../../../docs/deployment-support.md)
for current evidence and the ordered pair setup.

## Build and start in the checkout

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --dir contracts build
pnpm --dir connectors build
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
| `GEOWIZ_MODEL_CONFIG_FILE` | Private model profile for stdio synthesis; HTTP uses `modelConfigFile` in its private access JSON |
| Storage | SDK defaults to `./data/geowiz`; findings go to `./data/geowiz/findings` relative to working directory |
| `GEOWIZ_SOURCE_CONFIG_FILE` / `GEOWIZ_SOURCE_AUDIT_FILE` | Required private source/audit paths for stdio file reads; HTTP uses `sourceConfigFile` and its audit file |
| Input / output paths | Only configured approved sources are read; file-tool `outputPath` writes are denied |

`DATA_PATH` and `LOG_LEVEL` are not implemented environment settings here.
Setting them does not relocate persisted files, change log level or redact
outputs. [Source setup](DATA_SOURCES.md) supplies read-only root/grant/hash controls and
source audit; [correlated metadata export](../../../docs/employee-events.md) is optional.

Provider credentials must be injected through secret references outside prompts
and command history. Geologist and Geowiz share a configured production provider, with dedicated key
references. Follow [provider setup](../../../docs/model-providers.md).

## Use with the employee

Geologist uses the installed [Python MCP client](../../../sdk/python/README.md)
with the same private credential file as the launcher. Its imports/tests work independently;
the [generic-client test](HTTP_ACCESS.md#test-the-real-boundary-without-model-keys)
checks ingress now. Live providers, permitted sources and employee/task behavior
remain #671/#674; no model key grants tool authority.

## Persistence, containers and scaling

Geowiz holds HTTP session state and writes findings/artifacts. It is not
stateless infrastructure. Multiple clients/replicas require #668 isolation,
declared storage/concurrency and backend review enforcement; a load balancer
alone supplies none of those.

There is no tracked Geowiz Dockerfile, Compose recipe or published-image receipt
at the inspected baseline. #674 owns installable SDK dependencies and the real
reference image/network/mount recipes. This package currently declares
`workspace:*` SDK/contracts/connectors and a parent-relative test runner, so copying its folder or
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
professional cases, issuer/TLS deployment, protected review and employee
restart/restore still must pass before release support changes.
Record package and server versions separately, plus the actual runtime/model/
profile/image versions and limits. Follow [the MVP plan](../../../docs/mvp-release-plan.md).

## Optional event files

Add `eventConfigFile` only to the private HTTP launcher configuration, using the
[employee event setup](../../../docs/employee-events.md#configure-private-local-files).
It binds one approved assignment with a separate private JSONL destination.
A different deployment injects a trusted SDK event binding/export sink; it must
qualify its own durability and retention. The launcher remains portable local
reference evidence, not a mandatory cloud/SIEM integration.
