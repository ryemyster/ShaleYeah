# Deployment — @shaleyeah/sdk

The sdk is a library package — it is not deployed standalone. It is built and consumed by other packages in this workspace.

## Building for consumption

```bash
pnpm build   # emits ESM JavaScript + .d.ts to dist/
```

Packages in this workspace reference it as `"@shaleyeah/sdk": "workspace:*"`, resolved by pnpm to the local `dist/`.

## Environment variables

| Variable | Required by | Purpose |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | `LLMClient` | Authenticates Anthropic API calls |
| `PORT` | HTTP MCP mode | Integer 0–65535 with explicit `http.access`; absent selects stdio; 0 requests an OS-assigned test port |
| `MCP_HTTP_SESSION_IDLE_TIMEOUT_MS` | HTTP session lifecycle | Idle expiry; default 900000 ms (15 minutes) |
| `MCP_HTTP_REQUEST_TIMEOUT_MS` | HTTP session lifecycle | Each JSON body-read / accepted POST response deadline; default 120000 ms |
| `MCP_HTTP_MAX_SESSIONS` | HTTP session lifecycle | Active/pending initialized protocol instances; default 128, capacity returns 503 |

Limits accept positive finite integers up to 2147483647. Optional
`MCPServerConfig.http` values override these environment limits. JSON request
bodies are limited to 1 MiB. No provider key is needed for deterministic tools.

Sessions are process-local and end at shutdown/expiry/DELETE/response timeout.
Clients initialize after 404; session IDs do not grant authenticated identity,
source permissions or human approval. [HTTP access](http-access.md) requires
explicit local/remote identity, exact host/origin policy, scopes and an audit
sink. The default bind is loopback; qualified remote TLS/issuer/deployment is
separate. Do not infer hosted qualification from these settings.
Employee working context/review persists through its own adapters, not this map.

## When this package ships as an npm package

1. Bump version in `package.json`
2. `pnpm build` to regenerate `dist/`
3. `pnpm publish --access public` (requires npm token)
4. Downstream packages update `workspace:*` → the new semver range
