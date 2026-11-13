# Running the Market backend

Market runs as an ordinary Node/TypeScript MCP process with installed shared SDK dependencies. No orchestrator, database or paid feed is required.

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

No published Market image, gateway installation or production deployment is claimed by this package. Build/qualify the intended artifact and environment before use. The later #684 adoption owns full employee review/context and independent artifact/container qualification.

## Advisory exports and decisions

An explicit `outputPath` creates a new private file with mode `0600`. Existing files and symlinks are rejected; select a new path for another result. Exported narratives remain unreviewed. An operator must assess commercial suitability and approve consequential actions through the appropriate human workflow.
