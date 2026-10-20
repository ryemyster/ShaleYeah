# Installing the Economist

Run the employee and Econobot as separate units. The employee needs Python 3.12,
its declared wheels, privately selected model profiles and an MCP connection.
The tool server needs Node 22.13 or newer, declared runtime archives, private
financial source/review settings and an installed portable evaluation verifier.
It does not install the employee brain.

For local authoring, use `uv sync --locked`, configure the environment variables
in the [README](../README.md), and run `agents-cli run`. A host opens
`EconomistRuntime` with its own private catalog and current authority adapters
for durable assigned work. See [integration](INTEGRATION.md). Keep model, tool,
optional synthesis and judge credentials with their respective actors.

Build a wheel with `uv build --wheel`. Independent installations use the declared
helper wheels rather than workspace paths. The extraction checker in
[local testing](LOCAL_TESTING.md) generates a standalone source lock and installed
production tool lock, then runs native protected workflows outside the repository.

The separate Dockerfiles consume that extracted bundle and hash-locked production
dependencies. They select non-root users. Qualification records the resolved base
image digests and actual image IDs. The employee receives its own context state
and tool token; it does not receive the operator's source files, review policy or
human interface. The tool receives only its own sources/state and verifier.

Containers, VMs or other Python/Node hosts can use the same interfaces. No cloud,
warehouse or orchestrator is mandatory. Fixture checks qualify technical controls
only. Real operator data, rights, financial labels and professional acceptance
must be demonstrated separately before operational use.
