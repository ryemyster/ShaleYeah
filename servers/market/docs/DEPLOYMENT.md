# Running the Market backend

Market runs as an ordinary Node/TypeScript MCP process with installed shared SDK dependencies. No orchestrator, external database or paid feed is required. The optional employee review store uses local durable storage.

## Local stdio

After workspace dependency setup, from `servers/market`:

```sh
pnpm build
pnpm start
```

A generic MCP client may launch the compiled `node dist/index.js` entry. The process uses standard input/output for the protocol. Keep model/source credentials in a private environment; see [configuration](../README.md#host-configuration).

## Operator source records

Set `MARKET_SOURCE_FILE` to an absolute file owned by the operating user with mode `0600`. The file declares permitted observations or explicit reviewed assumptions in the [input format](INPUTS.md). It is reread to detect changed data or denied rights. The source file is host configuration, not a model-selectable path.

Without a source file, company metrics are unavailable. Without EIA access, benchmark fields are unavailable unless the host supplies an eligible observation. Model failure does not replace missing metrics. Set `MARKET_MAX_OBSERVATION_AGE_SECONDS` for the analysis's declared freshness window; source dates are never renewed by a fetch or cache hit.

## Protected HTTP

An HTTP deployment must construct the server with the [SDK's explicit access, identity/scope and audit configuration](../../../sdk/docs/http-access.md). A host can use `ServerFactory.createServer(createMarketTemplate(hostOptions))` and supply `ServerRuntimeOptions` at construction. `PORT` selects the listener only after that configuration exists; `PORT=3007` alone is rejected. Keep source, MCP access and model credentials separate.

`examples/local-http.mjs` loads `MARKET_HTTP_CONFIG_FILE`, an owned private JSON
file declaring `marketConfigFile`, `accessTokenFile`, `eventConfigFile` and
`dataPath`. All paths are absolute. The employee binding must include the MCP
token file in `sensitiveFiles`. Event configuration uses the shared required
JSONL emitter contract. The helper binds explicit local identity, tool scopes and
redacted audit; setting `PORT` alone supplies none of those.

The server and employee Dockerfiles consume the independent extraction bundle.
The tool image installs its own evaluation-only verifier without the employee app;
the employee image has no backend store. Both images declare a non-root user.
Run `scripts/check-extraction.mjs` and `scripts/check-containers.py` against the
intended artifacts before deployment. No published image, gateway installation
or production deployment is claimed.

## Advisory exports and decisions

An explicit `outputPath` creates a new private file with mode `0600`. Existing files and symlinks are rejected; select a new path for another result. Exported narratives remain unreviewed. An operator must assess commercial suitability and approve consequential actions through the appropriate human workflow.

## Configured advisory providers

The employee binding's optional `modelConfigFile` uses the shared agent/synthesis/
judge profile contract. It must select the task owner. This local binding resolves
private file references; remote secret systems use the host integration instead.
Model credentials are included in source redaction automatically. Profile/task
changes invalidate the running binding before or after a model request; reopen
with fresh configuration. An authenticated caller must match the synthesis owner.
Source facts do not require model availability, and ambient model keys do not
select an interpretation provider.
