# Running the Reporter service

Use Node 22.13 or newer and the declared package dependencies. In a checkout,
build contracts and SDK first, then run this package's `pnpm build`. `pnpm start`
starts stdio MCP with `REPORTER_CONFIG_FILE` pointing to owner-only configuration.

The configured directory holds private durable review state. Keep it across
restarts and restrict its filesystem owner and permissions. Source rights and
configuration are re-read; approval is bound to the exact source/report/task
revision. Missing qualification prevents approval and release.

HTTP hosts use the SDK's configured identity/scopes/audit transport with explicit
host/origin policy and separate credentials. The employee credential cannot
approve human reviews. Remote issuer/TLS, hosted infrastructure and live models
need separate observed qualification. No hosted deployment is implied by a local
package, an unexecuted container recipe or an example port.
