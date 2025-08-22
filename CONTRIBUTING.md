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
3. Implement the agent logic
4. Add tests and documentation
5. Update pipeline if needed

## Reporting Issues

- Use GitHub Issues for bugs and feature requests
- Include reproduction steps and environment details
- For security issues, see SECURITY.md

## Code of Conduct

This project follows a standard Code of Conduct. Be respectful, inclusive, and constructive in all interactions.

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.