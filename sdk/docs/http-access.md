# Configured MCP HTTP access

Every HTTP server must receive an explicit `http.access` configuration. Setting
`PORT` alone now fails before listening. STDIO stays a local process transport;
its launcher owns OS, source, credential and review policy. This SDK boundary
implements HTTP identity and ingress scopes under [ADR 0003](../../contracts/docs/0003-authority-and-review.md).

## Trust profiles

| Profile | Identity and network boundary |
| --- | --- |
| `local` | Configured operator principal and dedicated bearer credential; loopback bind, exact allowed hostnames/port and allowed origins; no anonymous local access |
| `remote` | Trusted injected `verifyBearer` adapter on every protected request; verified issuer, exact resource audience, epoch-second expiry, customer/employee ownership and scopes; exact host/origin policy |

Both require a versioned policy and an audit sink. The default bind is
`127.0.0.1`; local mode rejects non-loopback binds/hosts. Remote mode can declare
another bind behind a qualified TLS/private-ingress deployment. This Node HTTP
listener supplies no TLS termination or IAM authorization server. No forwarded
header establishes identity or overrides network policy.

Use dedicated MCP access credentials. Provider keys are not read as transport
authority and are never forwarded to tools/connectors. A remote adapter must
verify signatures or introspect tokens with maintained authentication libraries,
validate its issuer and return trusted `VerifiedMCPIdentity`. Decoding unverified
JWT JSON is insufficient. This SDK rechecks reported claims and ownership; it
cannot establish the honesty of a malicious operator-installed verifier.

## Policy and execution context

`policy.connectionScopes` applies to every protected request. `toolScopes` maps
exact registered tool names to required scopes; `resourceScopes` maps exact read
URIs. All listed scopes must be present. Missing classifications are denied.
The fixed supported protocol methods include initialization, ping, initialized/
cancelled/progress notifications, tool/resource discovery and responses within
an owned session. Tool calls and resource reads receive their additional checks.
Discovery permits metadata enumeration within connection authority; it does not
grant execution of the listed operations.

Each session is bound to issuer/operator, subject, customer and employee. POST,
SSE GET and DELETE authenticate again; a valid ID alone grants nothing. Updated
credentials can change scopes for the same owner, while another owner cannot
reuse that session. Revocation is checked through the verifier on each request;
an existing SSE stream is not continuously introspected. Reinitialize after the
normal session-expiry/termination behavior.

Tool/resource handlers receive an optional second `MCPExecutionContext` argument.
It contains immutable `principal` (`subjectId`, `customerId`, `employeeId`,
`scopes`), policy ID/version and generated request ID. Analysis factory callbacks
receive the same second argument. It contains no token, raw headers or request
claims. Concurrent requests keep separate contexts; STDIO supplies no invented
verified context. Source and protected-action adapters must use trusted context
rather than similarly named model arguments.

The public server configuration omits `http.access`; credentials and verifier
callbacks stay inside the private access adapter. Do not expose the trusted
configuration object used to construct that adapter.

Factory classes accept `new Server({ http: { access }, dataPath })`. Existing
constructors without options remain usable for STDIO. Existing HTTP launchers
must migrate to explicit configuration; an anonymous compatibility mode is not
provided. The [Geowiz local example](../../servers/geowiz/docs/HTTP_ACCESS.md)
provides a credential-file and local audit adapter without a cloud dependency.

## Remote adapter shape

Import these types from the public SDK. Trusted configuration and services
supply the callbacks; no token or policy is taken from model prose.

```typescript
const access: MCPHttpAccessConfig = {
  mode: "remote", bindHost: "127.0.0.1",
  allowedHosts: ["mcp.example.com"], allowedOrigins: [],
  issuer: "https://identity.example.com",
  resource: "https://mcp.example.com/mcp",
  authorizationServers: ["https://identity.example.com"],
  customerId: "customer-a", employeeId: "geologist",
  policy: {
    id: "geology-ingress", version: "r1",
    connectionScopes: ["mcp:connect"],
    toolScopes: { assess_quality: ["geowiz:quality"] }, resourceScopes: {},
  },
  verifyBearer: (token, signal) => trustedIdentityAdapter.verify(token, signal),
  audit: event => trustedAuditAdapter.record(event),
};
```

The verifier returns subject/customer/employee IDs, scopes, exact issuer/audience
and finite `expiresAt` in Unix seconds. Stable principal/policy/scope identifiers
are bounded to 128 ASCII letters/digits and `_.:/-`; adapters map external
identity conventions to those internal IDs. Scopes must be explicit, nonempty
arrays. The configured resource/issuer/authorization URLs require HTTPS, with
loopback HTTP permitted for declared development fixtures. No URL credential,
query or fragment is accepted.

`GET /.well-known/oauth-protected-resource` (also its `/mcp` variant) returns
configured resource metadata and supported scopes. A safe bearer challenge
points to that metadata. An actual OAuth issuer's discovery, grant/registration
flow, TLS, revocation and real-client conformance require separate deployment
qualification; deterministic injected-verifier tests do not certify them.
The selected [MCP 2025-11-25 authorization profile](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
defines per-request credentials and intended-resource validation. The SDK pin
remains 1.29.0; no newer profile is claimed.

## Failure, audit and limits

| Outcome | HTTP result before a handler runs |
| --- | --- |
| Missing/invalid/expired identity, wrong issuer/audience | 401 |
| Verified insufficient scope/ownership, stolen session, forbidden host/origin, unclassified operation | 403 |
| Required audit unavailable/timed out | 503 |
| Unknown route/session or normal protocol/body error | Existing bounded HTTP/protocol failure, without tool execution |

The endpoint is `/mcp`. Header credentials are required; query-string tokens and
other URL paths do not authorize access. Minimal `/health` and configured remote
resource metadata are public after host/origin checks. Origins are exact
allowlisted strings; an empty/absent list denies any supplied Origin while native
clients can omit it. Hostnames have no wildcard/forwarded-header exemption.

Verifier and sink deadlines default to 5000 and 1000 ms, configurable from 1 to
120000 ms. Timed-out verifier results are discarded; the adapter receives an
abort signal. Audit adapters own their cancellation/persistence/queue limits.
An identity that expires during required pre-dispatch audit is denied again.
Session/body/capacity limits remain in [deployment settings](DEPLOYMENT.md).

Audit events contain timestamp, generated request ID, policy/version, stable
decision/reason and classified operation, plus hashed principal/target references
where applicable. They exclude bearer/header values, raw IDs, arbitrary unknown
operation text, arguments and verifier/sink exception messages. `allow` records
an authorization attempt before dispatch, not successful domain completion.
A failed sink stops the operation. Full tracing/export/redaction and durable
sink qualification remain #574; exact-revision grants and transaction/restart
enforcement remain #673. Connector/file/source rights remain #670.

Ingress scopes do not approve interpretations, certify sources, grant source
export rights or authorize consequential domain actions. Each protected backend
still needs its operation-specific review policy. The reference employee uses the
installed [Python MCP client](../python/README.md) for credential/destination
handling; role/reference qualification is
#671/#674 and fleet release qualification remains #691/#693.

## Verification

`tests/mcp-http-access.test.ts` uses generic clients and direct HTTP with an
injected synthetic verifier: identity/scopes/ownership/session theft/revocation,
concurrency, model-claim bypass, audit/verifier failure, expiry during audit,
local restrictions and metadata. Existing session/schema/stdio checks remain.
Geowiz's `tests/http-access.test.ts` runs the actual backend and local launcher.
No live IAM credentials, professional quality acceptance or release support is
implied by these tests.
