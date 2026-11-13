# Local testing

Build and run the package suite:

```sh
pnpm build
pnpm test
```

No cloud, paid API key, database or listening HTTP port is required. The generic
client launches the built server over standard input/output, discovers its
tools, runs known cash flows and checks that incomplete legacy requests fail.
Unavailable IRR remains a successful calculation response with a null metric;
malformed requests are tool errors.

The pure tests cover published NPV/IRR fixtures, literal zeros, negative and high
rates, ambiguity, solver limits, unsupported periods, currency and scenario
mismatch. See [calculation rules](HOW_IT_WORKS.md) for their practical limits.
Use build before tests because protocol controls execute dist/index.js.
