# Deploy Title MCP

Install the declared TypeScript packages or their archives and run `pnpm build`. The package owns its compiler configuration and clears its generated `dist` before building. `node dist/index.js` is the compiled stdio entry. Set `TITLE_CONFIG_FILE` to an owner-only binding described in [inputs](INPUTS.md); with no binding, no work tools are advertised.

For the supplied protected HTTP example, set `PORT` and `TITLE_HTTP_CONFIG_FILE`, then run `node examples/local-http.mjs`. The latter private JSON names `titleConfigFile`, `accessTokenFile`, `eventConfigFile` and `dataPath`. Include the access-token file in the source binding's secret scan. Enroll host identity/scopes, exact host/origin policy and required redacted events. The example binds `127.0.0.1`; remote ingress/TLS and identity verification require an appropriate qualified host adapter.

Mount sources, sensitive files, private review/audit state and installed qualifier evidence explicitly. Preserve their UID ownership, retention and exact revisions across restart. An HTTP access token is separate from source permission and enrolled human authority. The backend needs no LLM key.

The [independent package check](../../../agents/title-analyst/docs/DEPLOYMENT.md) builds source exports, npm archives and Python wheels, installs their declared dependencies and records artifact/lock hashes. The backend's qualifier uses contract/evaluation wheels without the employee implementation. Require passing reports for the tested revision before making a support claim. No cloud deployment is included.
