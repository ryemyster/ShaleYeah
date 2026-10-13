# Development — Development MCP Server

Work here when the Development MCP tool contracts or deterministic backend behavior changes. Work in `agents/development-planner` when the ADK agent instructions, tool-selection behavior, evals, or docs change.

## Setup

```bash
cd servers/development
pnpm install
pnpm build
```

## Tests

```bash
cd servers/development
pnpm test
pnpm build
pnpm lint
```

## Boundaries

- TypeScript and pnpm are correct for this MCP server.
- Do not import from `agents/development-planner`.
- Do not implement HITL approval decisions here; the agent defers those in its prompt, tests, and evals.
- Do not import provider SDKs directly; use shared `callLLM` support from `@shaleyeah/sdk`.
- Keep deterministic fallback logic stable and covered by tests.
