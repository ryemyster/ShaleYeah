# Testing Geowiz locally

Geowiz is the TypeScript MCP backend; the Geologist employee is a separate
ADK/Python package. Build from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --dir sdk build
pnpm --dir servers/geowiz build
```

From `servers/geowiz`:

```bash
pnpm type-check
pnpm lint
pnpm test
```

Existing server/tool checks use declared fixtures. `tests/http-access.test.ts`
runs real loopback HTTP, the private local launcher and an external MCP client
with an ephemeral dedicated credential. It checks granted read, anonymous/
ungranted save denial and redacted ingress audit. No model key or live source is
required; observed completeness does not certify geological accuracy.

For a manual listener, follow [HTTP access setup](HTTP_ACCESS.md). PORT alone
fails before listening. Health establishes startup; `/mcp` requires configured
identity/scopes. SDK tests separately cover sessions, schemas, remote identity
and concurrent users.

The installed Geologist client passes protected connection controls. Run
[employee Python checks](../../../agents/geologist/docs/LOCAL_TESTING.md)
independently. Actual professional/source/provider behavior remains
#674. The initial LAS input/review checks are documented [here](LAS_REVIEW.md).
Run `pnpm test:review` after building Geowiz to exercise the real generic MCP
client, enrolled human CLI and protected save/restart controls at 90% coverage.
Agent confirmation alone does not authorize persistence.

| Symptom | Next step |
| --- | --- |
| Explicit trust/config error | Follow HTTP access setup or use managed STDIO with PORT unset |
| HTTP 401 | Resolve the dedicated credential or valid identity for this resource |
| HTTP 403 | Check trusted ownership, tool/resource scopes and host/origin policy |
| HTTP 503 before dispatch | Check required audit availability and configured capacity/timeouts |
| Build/import error | Build SDK, then Geowiz, using declared dependencies |

See [integration](INTEGRATION.md) and [deployment](DEPLOYMENT.md).

## Correlated reference trace

Run `pnpm test:las` from this package for the numeric LAS reference, real
CLI/MCP source controls and a 90 percent line-coverage gate on the LAS,
annotation and source-boundary modules. `pnpm test` also runs retained format
smoke tests. Their processor count is not line coverage or domain accuracy;
non-LAS formats remain outside this qualification.

[Generate the complete fixture trace](../../../docs/employee-events.md#generate-an-operator-readable-fixture-trace)
after building contracts, connectors, SDK and this server. It uses the actual
protected local launcher and native ADK with two offline provider transports.
It checks source hashes, client/backend parents and excluded credentials/content.
Successful tool execution remains separate from the missing-judge evaluation and
authored human-review fixtures.
