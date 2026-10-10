# Local Testing — @shaleyeah/sdk

## Quick start

```bash
cd sdk
pnpm build
npx tsx tests/sdk.test.ts
```

## Running all SDK tests

```bash
pnpm turbo test --filter=@shaleyeah/sdk
```

## Testing callLLM()

```bash
# Confirm LLM is actually invoked (auth error proves it)
ANTHROPIC_API_KEY=sk-fake npx tsx tests/llm-client.test.ts
```

## Testing MCPServer transport mode

```bash
# stdio mode (default)
npx tsx tests/mcp-server.test.ts

# HTTP mode
PORT=9999 npx tsx tests/mcp-server.test.ts
```

## Testing canonical schemas

Zod schemas are pure — no env vars needed:

```bash
npx tsx tests/canonical-model.test.ts
```

## Testing file parsers

Parser tests need sample files in `tests/fixtures/`:

```bash
npx tsx tests/parsers.test.ts
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot find module '@shaleyeah/sdk'` | Not built | `pnpm build` first |
| `any` type errors in server-factory | Intentional — see CLAUDE.md | Do not remove |
| Parser test failures | Missing fixture files | Add sample files to `tests/fixtures/` |
