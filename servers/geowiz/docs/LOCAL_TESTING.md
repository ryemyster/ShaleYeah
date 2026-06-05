# Local Testing — @shaleyeah/server-geowiz

## Quick start (stdio mode)

```bash
cd servers/geowiz
pnpm build
npx tsx tests/server.test.ts   # run all tests
```

## Quick start (HTTP mode)

```bash
# Terminal 1: start geowiz on port 3001
cd servers/geowiz
PORT=3001 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2: confirm it's up
curl http://localhost:3001/health

# Terminal 3: run agent tests against live server
cd agents/geologist
GEOWIZ_MCP_URL=http://localhost:3001 npx tsx tests/mcp-client.test.ts
```

## Unit tests only (no server required)

```bash
cd servers/geowiz
npx tsx tests/server.test.ts    # MCP integration tests (stdio)
npx tsx tests/tools.test.ts     # parser unit tests
```

## Anti-stub test (LLM wiring verification)

```bash
# Expects an auth error — proves callLLM() was actually invoked
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
```

A test pass here means the tool called the Anthropic API (and got rejected for the fake key). If no auth error: the LLM path was never reached.

## Live tool call via MCP CLI

```bash
# Install MCP CLI once
npm install -g @modelcontextprotocol/cli

# Start server in HTTP mode, then call a tool
PORT=3001 pnpm start &
mcp call http://localhost:3001 analyze_formation \
  '{"filePath":"tests/fixtures/sample.las","formations":["wolfcamp"]}'
```

## HITL testing

HITL gates live in the `geologist` agent, not in geowiz. To test HITL behavior:

```bash
cd agents/geologist
GEOWIZ_MCP_URL=http://localhost:3001 npx tsx tests/agent.test.ts
```

## Error classification testing

```bash
# Test retryable error path (bad URL → network error)
cd agents/geologist
GEOWIZ_MCP_URL=http://localhost:19999 npx tsx tests/mcp-client.test.ts
# Expect: error_type "retryable" in output
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3001` | Server not running in HTTP mode | `PORT=3001 pnpm start` |
| `No API key` warning | Missing `ANTHROPIC_API_KEY` | Set env var; fallback still works |
| LAS parse errors | File encoding or version mismatch | Check LAS 2.0 format; DLIS needs `process_well_logs` |
| `Cannot find module` | Build needed | `pnpm build` first |
| Tests hang | stdio mode conflict | Tests use stdio mock — don't set `PORT` when running unit tests |
