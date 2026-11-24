# Drilling MCP

Drilling checks supplied well/design options and evidence for a human engineer. The independent [Drilling Engineer](../../agents/drilling-engineer/README.md) uses it for current source access, exact arithmetic, citations and protected private review. Any compatible MCP client can use the same contract. The backend requires no model key.

It keeps measured depth (MD) and true vertical depth (TVD) and reference datums explicit, converts international feet/metres exactly, reconciles supplied quantities/rates/currencies, and sums declared sequential schedule phases. It preserves supplied engineering component references, hazards, mitigation reviews, offset applicability and unresolved exceptions. A quoted scope total is not total well cost or an AFE.

## Run

From this directory with Node >=22.13 and declared dependencies installed:

```sh
pnpm build
DRILLING_CONFIG_FILE=/absolute/private/drilling.json pnpm start
```

Keep `PORT` unset for a stdio child; stdout carries MCP messages. Without a source binding the server advertises no work tools. The [input guide](docs/INPUTS.md) describes operator files and private configuration.

For protected local HTTP, supply separate private source, access, event and review settings:

```sh
PORT=3003 DRILLING_HTTP_CONFIG_FILE=/absolute/private/drilling-http.json node examples/local-http.mjs
```

The example binds to loopback. A port supplies no identity or source rights. See [deployment](docs/DEPLOYMENT.md).

## Tools and review

`read_drilling_inputs`, bounded source/evidence reads and `cite_drilling_evidence` expose current permitted facts and backend-computed UTF-8 spans/hashes. `design_drilling_program`, `estimate_well_costs` and `assess_drilling_risks` retain the three role capabilities under exact task/source signatures. `draft_drilling_packet` validates proposed observations and returns canonical `work` and `drilling`. See [integration](docs/INTEGRATION.md).

`prepare_drilling_review` binds exact work, context and evaluation revisions. A separately enrolled human inspects sources, requests changes, rejects or approves. `record_drilling_packet` requires current installed qualification and the exact human grant; restart and replay cannot create another record.

Normalization, exact arithmetic and citation identity do not validate engineering sufficiency, complete quoted scope, mitigation effectiveness or safe operations. Private recording grants no spud, authorization for expenditure (AFE) or capital commitment, field operations, well-control, safety certification or professional acceptance.

## Check and package

```sh
pnpm type-check
pnpm lint
pnpm test
node scripts/check-extraction.mjs --bundle /absolute/empty/drilling-bundle --report /absolute/private/extraction.json
```

Extraction builds independent source, npm archives and Python wheels, exercises generic and external-compatible clients, and records artifact/lock hashes. Complete qualification requires native provider, exact source, human-review and installed-package journeys on the tested revision.
