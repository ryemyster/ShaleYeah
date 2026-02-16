# Contributing to SHALE YEAH

Thank you for your interest in contributing to SHALE YEAH! This project aims to modernize oil & gas data workflows through open-source automation.

## Getting Started

1. Fork the repository on GitHub (click the "Fork" button in the top right)
2. Clone your fork locally: `git clone https://github.com/YOUR-USERNAME/ShaleYeah.git`
3. Create a branch for your work: `git checkout -b feature/your-feature-name`
4. Install dependencies: `npm install --legacy-peer-deps`
5. Run the demo to verify everything works: `npm run demo`

## Development Guidelines

### Code Style
- Use TypeScript for CLI tools and HTTP integrations
- Keep tools runnable from CLI with clear error messages
- No giant dependencies - prefer lightweight, focused libraries

### Output Requirements
- Always write artifacts to `data/outputs/${RUN_ID}/`
- Include attribution footer in human-facing outputs:
  ```
  Generated with SHALE YEAH 2025 Ryan McDonald / Ascendvent LLC - Apache-2.0
  ```
- Prefer open formats: CSV, GeoJSON, OMF, LAS
- Declare units for depth, time, and spatial reference systems

### Security
- Never commit secrets, tokens, or credentials
- Read sensitive config from environment variables
- No proprietary or confidential data in examples
- Follow secure coding practices

## Submitting Your Work

When your changes are ready:

1. Push your branch to **your fork**: `git push origin feature/your-feature-name`
2. Go to the [SHALE YEAH repo](https://github.com/ryemyster/ShaleYeah) on GitHub
3. Click **"Compare & pull request"** (GitHub will prompt you automatically)
4. **Target the `develop` branch** — not `main`. All work merges into `develop` first.
5. Fill in the PR description explaining what you changed and why
6. A maintainer will review, leave feedback, and merge when it's ready

If your PR addresses a specific GitHub issue, reference it in the description (e.g., "Closes #123"). This links the PR to the issue and auto-closes it on merge.

## Finding Work

Not sure where to start? Check the [open issues](https://github.com/ryemyster/ShaleYeah/issues) and [milestones](https://github.com/ryemyster/ShaleYeah/milestones).

Issues are organized by milestone and labeled by area:

| Label | Meaning |
|-------|---------|
| `tier-1: production` | Production hardening — resilience, caching, reliability |
| `tier-2: dev-experience` | Developer experience — tooling, observability, composition |
| `tier-3: integration` | External integration — APIs, plugins, webhooks |
| `tier-4: scale` | Scale & governance — multi-tenant, permissions, versioning |
| `resilience` | Error handling, retries, circuit breakers |
| `composition` | Bundles, pipelines, chaining |
| `discovery` | Registry, search, introspection |
| `security` | Auth, permissions, audit |
| `observability` | Analytics, lineage, logging |
| `api` | HTTP, streaming, async |

Look for issues labeled `good first issue` if you're new to the project.

## Pull Request Guidelines

1. **Small PRs**: Keep changes focused and reviewable
2. **Tests**: Include tests for new functionality
3. **Documentation**: Update relevant docs and specs
4. **Clean**: Outputs should be readable and well-formatted

### PR Checklist
- [ ] Branch targets `develop` (not `main`)
- [ ] Code follows project style guidelines
- [ ] Tests pass locally (`npm run build && npm run type-check && npm run lint && npm run test && npm run demo`)
- [ ] Documentation updated
- [ ] Attribution footer included in outputs
- [ ] No secrets or proprietary data
- [ ] CHANGELOG.md updated

## Adding New Agents

1. Create a new server file in `src/servers/<agent-name>.ts`
2. Implement the agent logic — inherit `MCPServer`, add Roman persona
3. Classify all tools as `query`, `command`, or `discovery` (see `src/kernel/types.ts`)
4. Add tests and documentation
5. Register the server in `src/mcp-client.ts` server configs — the kernel registry picks it up automatically

## Adding Kernel Middleware

The kernel middleware pipeline (`src/kernel/middleware/`) supports pluggable middleware:

1. Create `src/kernel/middleware/<name>.ts` implementing your middleware class
2. Wire it into `src/kernel/index.ts` (constructor + `callTool` pipeline)
3. Add tests in `tests/kernel-<name>.test.ts` (use the simple assert pattern, not jest)
4. Update `docs/API_REFERENCE.md` and `docs/ARCHITECTURE.md`
5. Append entry to `CHANGELOG.md`

Existing middleware: `auth.ts` (RBAC), `audit.ts` (JSONL logging), `resilience.ts` (error classification), `output.ts` (detail levels).

## Testing

### Running Tests

```bash
npm run test              # Run all test suites (original + kernel)
npm run demo              # Integration test via demo (14 servers through kernel)
npm run server:geowiz     # Test individual server (all 14 available)
```

### Kernel Tests

Kernel tests use the **simple assert pattern** (not jest/vitest) and are self-contained with their own runner:

```bash
npx tsx tests/kernel-registry.test.ts    # Run a specific kernel test
npx tsx tests/kernel-executor.test.ts    # Each file runs independently
```

Test files follow the naming convention `tests/kernel-<module>.test.ts`. Key conventions:

- Use `node:assert` for assertions (`strictEqual`, `deepStrictEqual`, `ok`, `throws`)
- Each test file has its own runner at the bottom
- Mock dependencies inline — no mock framework needed
- Test both success and failure paths
- No network calls or external file I/O

### Pre-commit Checklist

Run the full validation suite before every commit:

```bash
npm run build && npm run type-check && npm run lint && npm run test && npm run demo
```

## Release Process

### Version Management

SHALE YEAH follows **semantic versioning** (semver):
- **Major (X.0.0)**: Breaking changes to public API
- **Minor (0.X.0)**: New features, backward compatible
- **Patch (0.0.X)**: Bug fixes, backward compatible

### Release Checklist

```bash
# 1. Full validation
npm run build && npm run type-check && npm run lint && npm run test

# 2. Demo works
npm run demo

# 3. Clean build test
npm run clean && npm install --legacy-peer-deps && npm run build && npm run demo
```

Then:
1. Update version in `package.json`
2. Update `CHANGELOG.md` with release notes
3. Create release branch: `git checkout -b release/vX.Y.Z`
4. Create release tag: `git tag vX.Y.Z`
5. Push and create GitHub release
6. Merge to main

## Reporting Issues

- Use GitHub Issues for bugs and feature requests
- Include reproduction steps and environment details
- For security issues, see SECURITY.md

## Code of Conduct

This project follows a standard Code of Conduct. Be respectful, inclusive, and constructive in all interactions.

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.