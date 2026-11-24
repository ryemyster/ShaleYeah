# Development — @shaleyeah/sdk

## Setup

```bash
cd sdk
pnpm install && pnpm build
```

## Test commands

```bash
npx tsx tests/*.test.ts
pnpm turbo test --filter=@shaleyeah/sdk
```

## Build output

```bash
pnpm build    # emits CJS + ESM + .d.ts to dist/
```

Downstream packages reference `"@shaleyeah/sdk": "workspace:*"`, resolved to the local `dist/`.

## Editing MCPServer (mcp-server.ts)

`MCPServer` uses `any` for Zod runtime interop — this is the only intentional `any` in the SDK. Do not remove it; it's required to accept arbitrary Zod schemas from server implementations.

## Editing server-factory.ts

`server-factory.ts` also uses `any` for the same reason. Both files are the documented exceptions in `CLAUDE.md`.

## Adding a new canonical schema

1. Add the Zod schema to `canonical-model.ts`
2. Export the type via `export type X = z.infer<typeof XSchema>`
3. Re-export from `index.ts`
4. Update `sdk/docs/ARCHITECTURE.md` schema table

## Key constraints

- Never add domain logic or O&G knowledge to the SDK — it provides infrastructure, not intelligence
- Never instantiate `@anthropic-ai/sdk` outside `llm-client.ts`
- `MCPServer` and `server-factory.ts` are the only files allowed to use `any`

## Linting

```bash
cd sdk && npx biome check src/
```
