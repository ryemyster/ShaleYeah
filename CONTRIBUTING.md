# Contributing to SHALE YEAH

Thank you for your interest in contributing to SHALE YEAH! This project aims to modernize oil & gas data workflows through open-source automation.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Run the demo: `bash scripts/demo.sh`

## Development Guidelines

### Code Style
- Use TypeScript for CLI tools and HTTP integrations
- Use Python for scientific computing and data processing
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

## Pull Request Process

1. **Small PRs**: Keep changes focused and reviewable
2. **Tests**: Include tests for new functionality
3. **Documentation**: Update relevant docs and specs
4. **Branding**: Ensure `scripts/verify-branding.sh` passes
5. **Clean**: Outputs should be readable and well-formatted

### PR Checklist
- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] Attribution footer included in outputs
- [ ] No secrets or proprietary data
- [ ] `scripts/verify-branding.sh` passes

## Adding New Agents

1. Create a spec in `specs/<agent-name>.spec.md`
2. Run `npm run gen` to generate agent scaffold
3. Implement the agent logic — inherit `MCPServer`, add Roman persona
4. Classify all tools as `query`, `command`, or `discovery` (see `src/kernel/types.ts`)
5. Add tests and documentation
6. Register the server in `src/mcp-client.ts` server configs — the kernel registry picks it up automatically

## Adding Kernel Middleware

The kernel middleware pipeline (`src/kernel/middleware/`) supports pluggable middleware:

1. Create `src/kernel/middleware/<name>.ts` implementing your middleware class
2. Wire it into `src/kernel/index.ts` (constructor + `callTool` pipeline)
3. Add tests in `tests/kernel-<name>.test.ts` (use the simple assert pattern, not jest)
4. Update `docs/API_REFERENCE.md` and `docs/ARCHITECTURE.md`
5. Append entry to `CHANGELOG.md`

Existing middleware: `auth.ts` (RBAC), `audit.ts` (JSONL logging), `resilience.ts` (error classification), `output.ts` (detail levels).

## Documentation Requirements

Every PR must include:
- Updated `CHANGELOG.md` entry
- Updated docs if the change affects APIs, architecture, or user-facing behavior
- Test coverage for new functionality

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