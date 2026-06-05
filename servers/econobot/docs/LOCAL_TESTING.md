# Local Testing — @shaleyeah/server-econobot

## Quick start (unit tests, no server required)

```bash
cd servers/econobot
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing

```bash
# Terminal 1: start econobot on port 3002
PORT=3002 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2: run agent tests against live server
cd agents/economist
ECONOBOT_MCP_URL=http://localhost:3002 npx tsx tests/mcp-client.test.ts
```

## Anti-stub test

```bash
ANTHROPIC_API_KEY=sk-fake npx tsx tests/server-anti-stub.test.ts
# Expect: authentication error (proves callLLM() was reached)
```

## Error classification testing

```bash
# Test retryable error (unreachable server)
cd agents/economist
ECONOBOT_MCP_URL=http://localhost:19999 npx tsx tests/mcp-client.test.ts
# Expect: error_type "retryable"
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3002` | Server not started in HTTP mode | `PORT=3002 pnpm start` |
| `Unsupported file type` | Non-Excel/CSV input | Use `.xlsx`, `.xls`, or `.csv` |
| `No API key` | Missing `ANTHROPIC_API_KEY` | Set env var; fallback DCF still works |
| Tests fail to import | Build needed | `pnpm build` first |
