# Title MCP

Title reconciles supplied ownership claims and prepares instrument-cited exception packets for a human title/land reviewer. The independent [Title Analyst](../../agents/title-analyst/README.md) uses this backend for source access, exact arithmetic and protected review. Any compatible MCP client can call it.

The backend keeps record title and operating rights separate by explicit depth band. Conveyances declare fraction-of-grantor or fraction-of-whole; royalty and ORRI terms declare working-interest or whole bases. Fractions remain exact strings such as `5/16`. Missing records or terms remain exceptions. No model key is needed for the backend.

## Run

From this directory, with Node >=22.13 and the declared dependencies installed:

```sh
pnpm build
TITLE_CONFIG_FILE=/absolute/private/title.json pnpm start
```

Keep `PORT` unset for an MCP client's stdio child. Stdout carries protocol messages. With no source binding, the server advertises no work tools. The [input guide](docs/INPUTS.md) describes the three exports and private operator configuration.

For protected local HTTP:

```sh
PORT=3010 TITLE_HTTP_CONFIG_FILE=/absolute/private/title-http.json node examples/local-http.mjs
```

The example requires separate private access, source, event and review settings and binds to loopback. A port alone supplies no identity or source rights. See [deployment](docs/DEPLOYMENT.md).

## Tools and review

Discovery and bounded reads expose permitted sources and instrument sections. `cite_title_instrument` computes UTF-8 quote spans/hashes. `examine_ownership`, `trace_chain_of_title`, `check_burdens` and `analyze_lease` expose source-bound views. `draft_title_packet` validates proposed observations and returns canonical `work` and `title` objects. See the [tool contract](docs/INTEGRATION.md).

`prepare_title_review` binds the exact work/context/evaluation revision. An enrolled human inspects source bytes, requests changes, rejects or approves through a separate API/CLI. `record_title_packet` requires current installed qualification and an exact human grant; restart and replay cannot create another record.

A supplied inventory is not complete public-record coverage. Operator-attested normalization does not verify OCR, authenticity, legal validity or professional entitlement. Private recording grants no title clearance, marketability certification, legal opinion, curative execution, filing, external transfer, lease acceptance or capital authority.

## Check and package

```sh
pnpm type-check
pnpm lint
pnpm test
node scripts/check-extraction.mjs --bundle /absolute/empty/title-bundle --report /absolute/private/extraction.json
```

The complete suite needs loopback HTTP. Extraction builds independent source, npm archives and Python wheels, tests a generic client and compatible external service, and records artifact/lock hashes. Required CI runs the native provider, current source, exact human review and installed-package journeys. Support claims require actual passing reports on the tested revision.
