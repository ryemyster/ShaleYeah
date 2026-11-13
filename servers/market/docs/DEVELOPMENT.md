# Developing the Market backend

Use the workspace setup in [Getting Started](../../../docs/GETTING_STARTED.md), then run these from `servers/market`:

```sh
pnpm build
pnpm type-check
pnpm lint
pnpm test
```

The package-local Node test command discovers `tests/*.test.ts` and enforces at least 90% implementation line coverage. Offline fixtures need no real EIA or model key. Tests use actual structured source records and controlled HTTP/model responses; they do not establish live-feed availability or commercial suitability.

Keep factual values in the source projection. Add an observation or an explicitly reviewed scenario record when a new metric is supported; do not add a default number, inferred company-size proxy or model-generated fact. Preserve source units, literal zero and observation dates. Unsupported fields stay unavailable with a reason.

The model's production dependency remains `callLLM` from `@shaleyeah/sdk`. Host integrations can supply `createMarketTemplate` options for source/model/price readers. These options are not MCP arguments. Provider or credential-resolution failures must return safe unavailable results without private error text.

Before changing a prompt, add control, edge and authority tests. Check actual source values independently of narrative output. Include stale observations, denied/changed source rights, unknown references, malformed model output and explicit assumptions. The initial #708 regression run failed eight semantic cases before implementation; the issue retains that receipt and the bounded repair plan.

`createEiaPriceClient` gives each host an independent cache and accepts explicit clock/fetch/credential/freshness options. `fetchEiaPrices` and `clearEiaCache` use the default client. A cache hit cannot renew an observation date. The higher-level analysis policy is separately supplied by the host/environment and reassesses the detailed observations.
