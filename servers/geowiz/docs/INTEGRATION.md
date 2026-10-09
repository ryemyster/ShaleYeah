# Integrating Geowiz

Geowiz is a separate MCP tool backend. The Geologist is an ADK/Python employee;
a generic compatible MCP client can also call granted tools. The reference
profile is MCP 2025-11-25 with TypeScript SDK 1.29.0.

## HTTP client boundary

Configure [HTTP identity/scopes](HTTP_ACCESS.md) first. The endpoint is `/mcp`.
Clients send a dedicated MCP bearer credential on every request, including
initialization, SSE GET and DELETE. Provider keys grant no MCP authority.

A TypeScript client declares the official MCP dependency:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(endpoint, {
  requestInit: { headers: { Authorization: `Bearer ${resolvedMcpCredential}` } },
});
const client = new Client({ name: "external-geology-client", version: "0.1.0" });
await client.connect(transport);
try {
  const result = await client.callTool({
    name: "assess_quality", arguments: { filePath: permittedPath, dataType: "las" },
  });
  consumeValidatedResult(result);
} finally {
  await transport.terminateSession();
  await client.close();
}
```

Endpoint selection, credential resolution, permitted path and result consumption
are trusted client responsibilities. The official transport is imported from
its declared package; the ShaleYeah SDK does not re-export it. See the actual
[generic-client test](../tests/http-access.test.ts).

Discovery advertises actual schemas. Preserve `isError`, structured evidence,
matching text and partial domain status; protocol completion does not accept
employee work. The shared [result contract](../../../sdk/docs/ARCHITECTURE.md#tool-contracts-and-result-compatibility)
and [confidence semantics](../../../sdk/docs/confidence-metadata.md) apply.

## Employee, source and review boundaries

The Geologist currently calls through `app/geowiz_mcp.py`. #679 replaces that
copied client with credential/destination handling before protected connection.
It does not use the retired TypeScript LocalAgentRuntime or a fixed employee port.

Files resolve on the tool host. Source/workspace controls remain #670; advertised
formats and geological evidence remain #671/#674. `assess_quality` currently
returns fixed metrics without opening the file; it qualifies ingress rather
than observed data quality. Model-assisted tools use shared `callLLM`; BYO
provider support remains #669.

The local example leaves `save_finding` ungranted. Authenticated exact-revision
backend review/resume remains #673. Agent confirmation or approval prose cannot
replace that gate.

STDIO is managed by a trusted local launcher. Remote deployments inject identity
and audit adapters through the [SDK API](../../../sdk/docs/http-access.md), then
qualify actual IAM/TLS, source/review and hosting. See [deployment](DEPLOYMENT.md)
and [local tests](LOCAL_TESTING.md).
