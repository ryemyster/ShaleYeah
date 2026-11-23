# Title Analyst architecture

Selected mode: **Stand-alone Agent with Progressive Disclosure (Skills)**. One native ADK employee loads current source detail and proposes cited observations. `ConfiguredModel` owns the explicit Gemini/Anthropic adapter and request budget. The installed employee runtime owns native execution, context selection and current-authority checks. No child specialists or custom reasoning loop are added.

`app/title_mcp.py` maps typed role arguments through the installed stateless MCP client. `app/context_runtime.py` binds all three permitted source identities, verified canonical work and pending review references into this employee's private catalog. `app/evaluation.py` parses the actual final response and calls the installed evaluation runner. `app/review_supervision.py` maps fixed review/status/record operations through the shared supervisor.

The independent Title backend owns exact arithmetic, original-text citations and durable consequential state. An enrolled qualified human inspects the exact packet and installed qualification before private recording. Model confirmation does not approve work. Changed/revoked sources invalidate continuation; retained context cannot grant title clearance, filing, transfer, lease acceptance or capital authority.

The simple ADK CLI app follows its host's session lifecycle. Durable guarantees require `TitleAnalystRuntime.open` with an operator-owned catalog and current source callbacks. No warehouse, orchestrator, cloud host or vector service is required. See [integration](INTEGRATION.md) and [deployment](DEPLOYMENT.md).
