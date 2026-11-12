# Developing Risk Analysis
Use the repository's [issue delivery contract](../../../docs/sdlc.md). Write failing numerical, source and authority controls before implementation. Keep changes within the owning role/backend; independent defects receive their own issues.

From this package run `pnpm build`, `pnpm type-check`, `pnpm lint` and `pnpm test`. The test command enforces 90% line coverage and serializes native fixture journeys. Install the matching Python employee first as described in [local testing](LOCAL_TESTING.md).

Keep domain validation/calculation separate from current-source and review authority. Missing input must remain unavailable or blocked. A numerical result cannot grant rights, a human decision or an output path.

The isolated extraction script must build source using only this package's config and declared dependency archives, then exercise installed wheels/tools. The required container job proves separate non-root images. Neither workspace compilation nor a Dockerfile substitutes for those checks.
