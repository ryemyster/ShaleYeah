# Security Policy

## Reporting Security Vulnerabilities

We take security seriously. If you discover a security vulnerability in SHALE YEAH, please report it to us privately.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please send a detailed report to: security@ascendvent.com

### What to Include

Please include as much of the following information as possible:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

### Response Timeline

- **72 hours**: Initial triage and acknowledgment
- **7 days**: Detailed assessment and response plan
- **30 days**: Resolution and disclosure timeline

## Security Best Practices

When contributing to SHALE YEAH:

- Never commit secrets, tokens, or credentials to the repository
- Use environment variables for sensitive configuration
- Follow secure coding practices for data handling
- Validate all inputs, especially file uploads and user data
- Use parameterized queries for database operations
- Implement proper error handling without exposing sensitive information

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Dependencies

We use automated dependency scanning through:
- Dependabot for dependency updates
- CodeQL for static analysis
- Gitleaks for secret detection

Keep dependencies up to date and report any security issues found in dependencies.