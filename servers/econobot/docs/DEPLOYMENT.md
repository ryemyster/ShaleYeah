# Running Econobot

From the workspace root, install the locked workspace dependencies using the
[setup guide](../../../docs/GETTING_STARTED.md). Then:

```sh
cd servers/econobot
pnpm build
pnpm test
pnpm start
```

The built entry is `dist/index.js`; the default transport is standard
input/output. No provider key is required for calculations. Use the MCP
2026-07-28 profile. Pass complete requests from the [README](../README.md).

For HTTP, create the server with host-owned identity/scope/audit configuration
from the [shared access guide](../../../sdk/docs/http-access.md). PORT alone
cannot enroll a protected server. Do not place credentials in tool arguments,
prompts, output files or retained results.

An embedding host can construct a server with
`ServerFactory.createServer(createEconobotTemplate(options))`. Optional
`options.synthesis` belongs to that host and uses the existing shared
`callLLM` adapter; the default CLI leaves interpretation disabled.
Do not expose that host configuration as a model tool.

Node >=22 and the declared SDK/Zod runtime dependencies are required. This issue
verifies local built-server behavior; it does not publish an image or certify a
cloud deployment. Standalone source/archive/container qualification for the
Economist employee remains in its adoption and fleet acceptance work.
