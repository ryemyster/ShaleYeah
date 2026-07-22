# Deployment — @shaleyeah/sdk

The sdk is a library package — it is not deployed standalone. It is built and consumed by other packages in this workspace.

## Building for consumption

```bash
pnpm build   # emits CJS + ESM + .d.ts to dist/
```

Packages in this workspace reference it as `"@shaleyeah/sdk": "workspace:*"`, resolved by pnpm to the local `dist/`.

## Environment variables

| Variable | Required by | Purpose |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | `LLMClient` | Authenticates Anthropic API calls |

No other env vars. Servers and agents bring their own config.

## When this package ships as an npm package

1. Bump version in `package.json`
2. `pnpm build` to regenerate `dist/`
3. `pnpm publish --access public` (requires npm token)
4. Downstream packages update `workspace:*` → the new semver range
