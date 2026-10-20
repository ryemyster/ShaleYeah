# Running Econobot

Use Node 22.13 or newer. From this directory, run `pnpm build`, `pnpm type-check`,
`pnpm lint`, `pnpm test` and `pnpm start`. The built entry is `dist/index.js`.
The default transport is standard input/output using MCP 2026-07-28. Direct
calculations require no model key; pass complete versioned requests from the README.

For the source-backed employee workflow, set `ECONOBOT_CONFIG_FILE` to an
owner-only JSON binding. It selects actual operator CSV exports, exact task and
scenario definitions, current rights, an enrolled human and private state/audit
locations. See [financial inputs](EMPLOYEE_INPUTS.md). Install the declared
portable contract/evaluation verifier wheels when protected review is enabled.
The backend verifier imports no employee app.

For authenticated local HTTP, provide a private launcher file through
`ECONOBOT_HTTP_CONFIG_FILE` with `economicConfigFile`, `accessTokenFile`,
`eventConfigFile` and `dataPath` absolute paths. Add the tool-token file to the
economic binding's `sensitiveFiles` scanner list. The event configuration follows
the [event guide](../../../docs/employee-events.md); it requires a private sink,
exact task scope/revision and matching correlation. Then run:

```sh
PORT=3002 node examples/local-http.mjs
```

The listener binds loopback with explicit bearer access, scopes and audit. PORT
alone cannot enroll a server. Remote hosts must provide their own qualified TLS,
identity and ingress adapter using the [shared access guide](../../../sdk/docs/http-access.md).
Keep secrets outside prompts, tool arguments and retained output.

The human uses the separate `examples/review.mjs` CLI with `ECONOBOT_CONFIG_FILE`:
inspect the exact packet into a new private file, then approve, reject or request
changes with an owner-only reason file. An installed qualification bundle bound
to that exact packet is required. Earlier approvals fail if sources, assumptions,
rights, policy or qualification changes. Private scenario approval does not commit capital.

From the repository root, create an independent source/archive/wheel bundle:

```sh
node servers/econobot/scripts/check-extraction.mjs \
  --bundle /absolute/empty/economist-bundle --report /absolute/extraction.json
python3 servers/econobot/scripts/check-containers.py \
  --bundle /absolute/economist-bundle --report /absolute/containers.json
```

The checker installs declared archives and wheels outside the checkout, builds
standalone source, repeats actual native/generic/external tests and records hashes.
Separate Dockerfiles consume hash-locked production dependencies and run non-root.
The image check requires Linux Docker, records resolved base/image identities,
and uses separate operator and employee state mounts. Missing runtimes produce
blocked reports. CI receipts, not the presence of a Dockerfile, establish a pass.
