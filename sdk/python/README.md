# Python MCP client

`shaleyeah-mcp-client` is an installable HTTP client for independent employee
packages. It uses the maintained Python MCP SDK for protocol/session handling.
It has no ADK, model-provider, business-role, warehouse or monorepo-source import.

The first consumer is [Geologist](../../agents/geologist/README.md).
The role keeps its tool names, inputs, prompts and review responsibilities;
this package owns credential handling, bounded connection setup, discovery,
schema checks and result preservation.

## Install and use

From this directory:

```sh
uv sync --locked
uv run --locked ruff check .
uv run --locked pytest -q --cov=shaleyeah_mcp --cov-fail-under=90
uv build --wheel
```

For a separate repository, install the built
`dist/shaleyeah_mcp_client-0.1.0-py3-none-any.whl`. Nothing has been published
to a package registry by this change. Declare `shaleyeah-mcp-client==0.1.0` as a
dependency and supply that wheel or your approved package index. Local Geologist
development uses an explicit editable uv source; its built wheel has the normal versioned
dependency and works with this client wheel outside the checkout.

```python
from pathlib import Path
from shaleyeah_mcp import FileBearerCredential, MCPClientConfig, call_tool

config = MCPClientConfig(
    endpoint="http://127.0.0.1:3001/mcp",
    credential=FileBearerCredential(Path("/absolute/private/geowiz-mcp-token")),
    allow_loopback_http=True,
)
result = await call_tool(config, "assess_quality", {"filePath": "approved.las", "dataType": "las"})
if result["isError"]:
    # Preserve the failure for the employee/human to assess.
    ...
```

Configure the actual tool's inputs and ingress policy; the example requires a
trusted scope grant. Start Geowiz with its [private local setup](../../servers/geowiz/docs/HTTP_ACCESS.md).
Its current quality tool uses fixed metrics; successful transport does not
establish source quality or professional correctness.

## Configuration and credentials

`MCPClientConfig` is frozen. It requires a validated endpoint and asynchronous
credential provider. A provider resolves one dedicated bearer credential from a
trusted reference on each attempt; another secret manager can implement that
callable. Provider keys and model arguments are not consulted for tool authority.

HTTPS is required except explicit loopback development HTTP. URL credentials,
query strings/fragments, invalid ports and non-ASCII/control characters are
rejected before credential resolution. Redirects and ambient HTTP proxy trust
are disabled; TLS verification remains enabled. Use an approved exact destination.

`FileBearerCredential` accepts an owned private regular file, at most 4096 bytes.
Group/other permissions and final-component symlinks are rejected. This adapter
needs POSIX `O_NOFOLLOW`; operators must protect parent directories. Its reference
and credential provider are excluded from representations. It rereads on the next
call/attempt; no token is returned in the result envelope.

| Setting | Default | Accepted bound |
| --- | --- | --- |
| `total_timeout` | 30 seconds | Greater than zero through 120 |
| `request_timeout` | 10 seconds | Greater than zero through 120; total deadline still applies |
| `preflight_attempts` | 2 | 1 through 3, including the first attempt |
| `retry_delay` | 0.1 seconds | 0 through 10, within the total deadline |
| `protocol_versions` | `("2025-11-25",)` | Nonempty tuple of explicitly selected versions supported by pinned MCP 1.28.1 |
| `allow_loopback_http` | `False` | Explicit boolean; affects loopback only |

The transport pins MCP 1.28.1, HTTPX 0.28.1, AnyIO 4.14.2 and JSON Schema 4.26.0.
Locks and qualification record transitive dependencies; a new pin/profile needs
the conformance suite again. Primary implementation references:
[modern HTTP transport](https://github.com/modelcontextprotocol/python-sdk/blob/v1.28.1/src/mcp/client/streamable_http.py),
[client session](https://github.com/modelcontextprotocol/python-sdk/blob/v1.28.1/src/mcp/client/session.py)
and [MCP security guidance](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices).

## Results and failures

The returned dictionary retains `content`, `structuredContent` and `isError`.
It validates advertised input/success-output schemas, structured-only results,
matching JSON text and bounded paginated discovery. Unknown/duplicate tools,
repeated cursors, more than 32 pages, inconsistent results and excessive legacy
wrapper nesting fail closed. Native tool errors and recognized legacy failures
stay errors; partial output stays partial. Errors need not match success schemas.

Transport/contract failures raise `MCPClientError`, a `RuntimeError` with stable
`code`, `category` (`auth_required`, `user_action`, `retryable`, `permanent`)
and `effect_unknown`. Its message excludes raw exception text, headers,
credentials and remote error prose. Tool content is retained as domain evidence;
the employee's audit/export layer must apply its data/redaction policy.

Only transient connection/setup/discovery failures before `tools/call` may retry.
401/403, redirects, incompatible profiles/schemas and credential problems stop.
After dispatch starts, no tool is automatically replayed. A failed/timed-out
dispatch is conservatively marked `effect_unknown`; investigate before another
action. A `retryable` category does not authorize replay of an uncertain effect.

One call owns a fresh SDK session. Normal completion requests DELETE and closes
local HTTP/stream resources. Cancellation propagates; timeouts are typed failures.
A later independent call initializes again. Broken networks/cancellation cannot
guarantee server termination or rollback; server idle limits and operation-specific
recovery still apply. There is no pooling, custom protocol loop, resumable event
store or workflow-restart mechanism here.

## Verify interoperability and extraction

From the repository root after building the SDK and Geowiz:

```sh
bash sdk/python/scripts/check-isolation.sh
uv run --project agents/geologist --locked python sdk/python/scripts/check_geowiz.py
```

Isolation builds client/Geologist wheels, installs locked dependencies and both
wheels into a temporary Python 3.12 environment, clears inherited source paths,
checks installed module locations and runs helper/role controls outside the
checkout. The second command starts the actual protected Geowiz local launcher
with temporary private credentials and checks authorized read, denied save,
anonymous denial and redacted audit. No model/IAM keys are used.

Shared CI runs these controls, helper lint/coverage and the first consumer's
package tests. Fleet clients, real identity issuers/TLS, professional source
acceptance, backend human-review grants and full release qualification remain
with their owning issues. Ingress credentials do not approve geological work.

See [SDK HTTP access](../docs/http-access.md) and the
[migration ledger](../../docs/legacy-migration-ledger.md) for boundaries and
remaining employee adoption owners.
