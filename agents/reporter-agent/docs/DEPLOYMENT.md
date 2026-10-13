# Running Reporter

Reporter is a portable Python package. Install its declared dependencies with
`uv sync --locked` in this directory. The development manifest selects no hosted
deployment target. `agents-cli info` identifies the package; it does not deploy it.

For local development, provide private model profiles and a separately configured
MCP credential, then use native ADK development tooling against `app`. Development
sessions use the CLI's in-memory behavior. A durable embedding host opens
`ReporterRuntime` with a scoped `ContextCatalog`, current authority callbacks and
an owned private persistent directory. Keep this directory when restarting.

The employee can connect to an external compatible MCP service through
`REPORTER_MCP_URL`. The tool service must enforce source rights and exact human
review. Production ingress, TLS, issuer verification, backup/restore and live
model/job quality require their own qualification. No cloud deployment or public
image release is supplied by the development manifest.

The wheel includes public role evaluation configuration under `app/reference/`.
Build clean source and qualify the separate employee/tool container pair using
the [reference package guide](../../../docs/reference-packages.md#reporter-employee-and-tools).
The resulting report limits support to its tested revision and architecture;
deployment recipes alone are not execution evidence.
