# Local Testing — @shaleyeah/server-drilling

## Quick start

```bash
cd servers/drilling
pnpm build
npx tsx tests/server.test.ts
```

## HTTP mode testing

```bash
# Terminal 1
PORT=3003 ANTHROPIC_API_KEY=sk-... pnpm start

# Terminal 2
cd agents/drilling-engineer
DRILLING_MCP_URL=http://localhost:3003 agents-cli run \
  "Design a drilling program for a horizontal Wolfcamp well at 10000 ft"
```

## Test the fallback path

Run without an API key to confirm deterministic fallback works:

```bash
# No ANTHROPIC_API_KEY set
npx tsx tests/server.test.ts
# Should pass — deriveDefaultDrillingInterpretation() provides the interpretation
```

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :3003` | Server not started in HTTP mode | `PORT=3003 pnpm start` |
| `Invalid well type` | Bad enum value | Use `"vertical"`, `"horizontal"`, or `"directional"` |
| Tests fail to import | Build needed | `pnpm build` first |
