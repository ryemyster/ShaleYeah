# Local Testing

Run deterministic Python tests from the package:

```bash
cd agents/infrastructure-planner
uv run pytest
```

These tests verify ADK project shape, Python MCP wrapper argument mapping, eval harness shape, and the absence of dangling TypeScript agent files.

## Live MCP Smoke Test

Start the backend separately:

```bash
cd servers/infrastructure
PORT=3012 pnpm start
```

Then run ADK commands from this package with:

```bash
cd agents/infrastructure-planner
INFRASTRUCTURE_MCP_URL=http://localhost:3012 agents-cli run "Plan pipeline infrastructure for 12 Reeves County wells with 7200 BOPD expected production."
```

Use evals for behavior quality and HITL boundary checks; use pytest for deterministic code shape and wrapper contracts.
