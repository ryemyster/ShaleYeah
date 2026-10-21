# Running Curve-smith

Complete the repository's [locked workspace setup](../../../docs/GETTING_STARTED.md),
then run these commands from the repository root:

```sh
pnpm --dir servers/curve-smith build
pnpm --dir servers/curve-smith start
```

The build writes `dist/`. With `PORT` unset the server uses stdio; setting a
port enables HTTP through the shared SDK. Configure the SDK's identity/scopes
and network boundary for access-sensitive HTTP use. This numerical repair does
not add a production deployment, publish an image or qualify the whole
Reservoir Engineer pair for extraction/container operation.

The versioned calculation tools require no model key. Optional type-curve
interpretation is configured explicitly by embedding host code:

```ts
import { CurveSmithServer } from "./dist/index.js";

const server = new CurveSmithServer({
  synthesis: { apiKey: operatorSecret, model: operatorSelectedModel }
});
```

`operatorSecret` and `operatorSelectedModel` come from the host's private
configuration. Pass the instance to the usual SDK runner. A request must also
set `includeInterpretation: true`; no ambient provider is enabled for this
versioned path. Never put credentials in tool arguments, histories or reference
records. The older `analyze_decline_curve` interpretation still uses its existing
`ANTHROPIC_API_KEY` configuration; its broader fit behavior remains outside the
new numerical qualification.

Run package-local verification after building:

```sh
pnpm --dir servers/curve-smith type-check
pnpm --dir servers/curve-smith lint
pnpm --dir servers/curve-smith test
pnpm --dir servers/curve-smith test:coverage
```

Tests include an actual stdio child process and require no live keys. Coverage
is explicitly limited to the repaired numerical/interpretation modules, with
90% required. Existing file-fit/quality paths and professional/whole-pair
acceptance remain assigned to #681. No specific cloud, warehouse or orchestrator
is required for these calculations.
