# Security Policy

## Permission Model

SHALE YEAH uses role-based access control (RBAC) when `KERNEL_AUTH_ENABLED=true`.

### Roles & Permissions

| Role | Permissions | Description |
|---|---|---|
| `analyst` | `read:analysis` | Read-only access to all query tools |
| `engineer` | + `write:reports` | Can generate reports via reporter |
| `executive` | + `execute:decisions` | Can trigger investment decisions |
| `admin` | + `admin:servers`, `admin:users` | Full system access |

### Tool Access

- **Query tools** (12 servers): require `read:analysis`
- **Reporter tools**: require `write:reports`
- **Decision tools**: require `execute:decisions`
- **Admin tools**: require `admin:servers`

Roles are hierarchical — each role inherits all permissions from lower roles.

## Audit Trail

All tool invocations through `kernel.callTool()` produce structured audit entries:

- **Storage**: Append-only JSONL at `data/audit/YYYY-MM-DD.jsonl`
- **Entries**: request, response, error, and denied events
- **Fields**: tool, action, parameters, userId, sessionId, role, timestamp, success, durationMs
- **Redaction**: Keys matching `/key|token|secret|password|credential|auth|bearer/` are replaced with `[REDACTED]`

Enable/disable via `KERNEL_AUDIT_ENABLED` (default: true).

## Secret Handling

- API keys and tokens should be stored in `.env` (never committed to git)
- `.env` is in `.gitignore`
- Audit logs automatically redact sensitive parameter values
- No secrets are logged in plain text

## Data Handling

- Session data is in-memory only (not persisted)
- Audit logs are the only persistent data written by the kernel
- No user data is transmitted externally — all analysis runs locally

## Configuration

```bash
KERNEL_AUTH_ENABLED=true|false   # Enable permission gates (default: false)
KERNEL_AUDIT_ENABLED=true|false  # Enable audit logging (default: true)
KERNEL_AUDIT_PATH=data/audit     # Audit log directory
```

## File Format Licensing

SHALE YEAH's proprietary file format support (e.g., `.accdb`, `.docx`, ARIES `.adb`) is provided under the DMCA Section 1201(f) interoperability exception, which permits reverse engineering for compatibility with independently created programs.

Users are **solely responsible** for obtaining appropriate software licenses for any proprietary formats they process and for complying with all applicable EULAs. SHALE YEAH does not provide, distribute, or include any proprietary software licenses. File format support is provided for interoperability purposes only.

This approach is consistent with established legal precedent (*Sega v. Accolade*, 1992) and the Apache 2.0 license liability disclaimers under which this project is distributed. See [LICENSE](LICENSE) for full terms.

## Vulnerability Reporting

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email: security@ascendvent.com
3. Include: description, reproduction steps, and potential impact
4. We will acknowledge within 48 hours and provide a fix timeline

## License

SHALE YEAH is licensed under Apache-2.0. See [LICENSE](LICENSE) for details.
