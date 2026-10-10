# Local and remote HTTP access

Geowiz accepts HTTP only with explicit identity and scope configuration. Use the
local example below for a single operator's private test environment. A remote
deployment supplies a trusted verifier and audit adapter through the
[SDK access API](../../../sdk/docs/http-access.md); it separately qualifies TLS,
issuer integration and source/review policy.

## Build and create a private local configuration

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --dir sdk build
pnpm --dir servers/geowiz build
```

For a fresh local setup, this one-time command creates a dedicated random access
credential and configured identity/policy outside the repository. It stops if a
credential/config file already exists. Choose the actual permitted operator,
customer and employee in the private configuration before granting real data.

```bash
export SHALE_GEOWIZ_PRIVATE_DIR="$HOME/.config/shaleyeah/geowiz"
node --input-type=module <<'JS'
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const dir = process.env.SHALE_GEOWIZ_PRIVATE_DIR;
await fs.mkdir(dir, { recursive: true, mode: 0o700 });
const policy = JSON.parse(await fs.readFile("servers/geowiz/examples/local-http-policy.json", "utf8"));
policy.accessTokenFile = path.join(dir, "credential");
policy.auditFile = path.join(dir, "audit.jsonl");
policy.dataPath = path.join(dir, "data");
await fs.writeFile(policy.accessTokenFile, randomUUID(), { mode: 0o600, flag: "wx" });
await fs.writeFile(path.join(dir, "access.json"), JSON.stringify(policy, null, 2), { mode: 0o600, flag: "wx" });
JS
```

The sample grants connection and only `assess_quality`. That existing tool
returns fixed quality metrics without opening the given file; it is a transport
control, not observed LAS quality. #671 supplies input-derived evidence. Other
tools, including `save_finding`, are ungranted. Extending ingress scopes does not
replace source checks or exact-revision human review.

## Start and verify

```bash
PORT=3001 GEOWIZ_HTTP_CONFIG_FILE="$SHALE_GEOWIZ_PRIVATE_DIR/access.json" \
  pnpm --dir servers/geowiz start:http
```

The tracked [launcher](../examples/local-http.mjs) reads bounded regular private
files while rejecting final-component symlinks, checks ownership/permissions, binds to loopback
and injects the credential-free policy into Geowiz. This example requires OS
no-follow/private-file semantics; other hosts supply their qualified secret/
audit adapter through the portable SDK. Protect the parent directory through
operator OS permissions. The launcher never prints the credential.
Stop the owned process with Ctrl-C. Rotate its credential through the private
file and restart; no model-provider key is used for MCP access.

In another terminal:

```bash
curl --fail http://127.0.0.1:3001/health
```

The health response reports `geowiz` / `1.0.0`, supplied by the SDK factory.
The protected endpoint is `http://127.0.0.1:3001/mcp`. Generic MCP clients load
the dedicated credential securely and send `Authorization: Bearer ...` on every
request, including GET/DELETE; never place its literal value in shell history,
prompts or artifacts. `PORT=3001 pnpm start` without access configuration now
fails before listening. `pnpm start` with PORT unset retains STDIO.

## Test the real boundary without model keys

From `servers/geowiz`, after the builds above:

```bash
pnpm exec tsx --test tests/http-access.test.ts
```

The test runs the real backend and launcher with ephemeral private files and a
generic client outside the ShaleYeah employee: granted read succeeds, anonymous/
ungranted save requests fail, and audit excludes the token. It does not inspect
a real source, call a model, validate the tool's fixed quality scores or accept
a geological interpretation. The SDK suite separately covers verified remote
identity, scope failures, stolen sessions, revocation and concurrent users.

The local audit file serializes allowlisted events with fsync before successful
dispatch and bounds queued writes at 128. Full/failed/timed-out audit prevents
execution. Events record authorization attempts, not domain completion. This
single-process example does not certify multi-process durability, backup/replay,
SIEM integration or protected-action transactionality; #574/#673 own those gates.

## Employee client and qualification

Geologist uses the installed [Python client](../../../sdk/python/README.md) and
loads the same private credential file through `GEOWIZ_MCP_ACCESS_TOKEN_FILE`.
The actual pair's ingress controls and isolated installed-wheel checks pass;
see [employee testing](../../../agents/geologist/docs/LOCAL_TESTING.md).
These controls and the generic-client backend test supply bounded connection
evidence. BYO providers, sources, durable
context/review and real professional cases remain #670/#671/#672/#673/#674.

Remote verifiers and private policies are operator services, separate from model
keys and agent prompts. The public SDK context preserves verified customer/
employee ownership and per-operation scopes. A session ID, Roman persona or
model-generated approval never grants access.
