# Development — Research MCP Server

Work here when the Research MCP tool contracts, source adapters, or deterministic backend behavior changes. Work in `agents/research-analyst` when the ADK agent instructions, source-quality reasoning, tool-selection behavior, evals, or docs change.

## Setup

```bash
cd servers/research
pnpm install
pnpm build
```

## Tests

```bash
cd servers/research
pnpm test
pnpm build
pnpm lint
```

## Boundaries

- TypeScript and pnpm are correct for this MCP server.
- Do not import from `agents/research-analyst`.
- Do not implement HITL approval decisions here; the agent defers those in its prompt, tests, and evals.
- Do not import provider SDKs directly; use shared `callLLM` support from `@shaleyeah/sdk`.
- Keep deterministic fallback logic stable and covered by tests.
- Respect source licensing, fair-access rules, and approved connector boundaries.
