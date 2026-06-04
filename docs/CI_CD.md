# CI/CD Gates

SHALE YEAH uses phased CI/CD so open-source contributors get fast feedback without removing production-grade checks.

## Gate Philosophy

| Phase | When it runs | Purpose |
| --- | --- | --- |
| PR checks | Every PR into `develop` or `main` | Fast correctness checks that contributors should pass before review |
| Branch hardening | Pushes to `develop` and `main` | Heavier confidence checks after code is integrated |
| Scheduled security | Weekly and manual runs | Deeper security scans without blocking every contributor PR |
| Release package | Tags, published releases, or manual dispatch | Rebuild, verify, and package the open-source release artifact |

The intent is to keep PRs lightweight while preserving a path to production-worthy releases.

## Pull Request Gates

PRs run:

- `pnpm turbo type-check`
- `pnpm turbo lint`
- `pnpm turbo build`
- `pnpm turbo test`
- Secret detection

These checks catch TypeScript errors, formatting/lint issues, build breakage, unit/integration failures, and accidental secret commits. They do not run coverage, demo smoke, CodeQL, or release packaging on every PR.

## Branch Hardening

Pushes to `develop` and `main` run the PR checks plus:

- `pnpm demo`
- `pnpm turbo test` (coverage via c8 per package)
- CodeQL security analysis

This keeps expensive or slower checks on trusted branch integration, where they protect the project without slowing every external contributor loop.

## Scheduled and Manual Security

Security workflows also support scheduled and manual runs:

- CodeQL: weekly Monday
- Gitleaks: weekly Sunday
- Manual dispatch for both workflows

This preserves ongoing security review even when code is quiet.

## Release Gate

Releases run one package job:

- Install dependencies
- Type-check
- Lint
- Build
- Test
- Demo smoke
- Create a tarball
- Generate `SHA256SUMS.txt`
- Upload release artifacts

SLSA provenance and Cosign signing are intentionally deferred until SHALE YEAH publishes stable release artifacts to package registries. For now, SHA hashes plus least-privilege GitHub permissions are the right level of open-source release hardening.

## Dependabot Noise Control

Dependabot groups routine updates:

- Runtime dependencies
- Development tooling
- GitHub Actions

This reduces PR volume while keeping dependency maintenance active on `develop`.

