# Rule: Context Engine — Mandatory Scout Usage

**Service:** `http://localhost:8088` (context-engine — read-only local context scout and delegation layer)
**Primary interface:** MCP tools (server name: `context-engine`) — no curl needed for most operations.

**Path convention:** all `path` params must be prefixed with `ryemyster/ShaleYeah/` — e.g. `"ryemyster/ShaleYeah/src/kernel"`. Never use bare `"src/..."` — the engine root is `~/Repos`, not this repo.

## Decision rules

| Situation | Action |
|---|---|
| Starting any non-trivial task | `load_context` MCP tool — call with `task` + `paths` before planning |
| Open-ended investigation or multi-step exploration | `investigate_codebase` MCP tool — primary delegation pattern |
| Need to know what is in a directory | `scan_directory` MCP tool |
| Need to find where a concept lives | `find_in_code` MCP tool |
| Need all routes in a file tree | `POST /routes` via curl |
| Need to understand one specific file | `summarize_file` MCP tool |
| Need the import graph of a path | `dependency_analysis` MCP tool |
| After any set of code edits | `review_diff` MCP tool with `git diff HEAD` output — read risks and test recommendations |
| Want semantically similar code chunks | `vector_search` MCP tool (only after `/index` has been run) |
| Evidence-based issue triage | `audit_issue` MCP tool |
| Mechanical work — single file, spec is clear | `POST /draft` via curl — read `draft-*.md`, verify, then apply |
| Mechanical work — multi-file, spec is clear | `POST /scaffold` via curl — read each `scaffold-*.md`, review all before applying any |
| Scout is unreachable | Proceed without it — never block on the scout |

**Do not delegate to /draft or /scaffold:** novel architecture, auth/security paths, complex multi-system logic — anything requiring judgment.

## Curl-only endpoints (no MCP equivalent)

```bash
# Single-file mechanical work
curl -s -X POST http://localhost:8088/draft \
  -H "Content-Type: application/json" \
  -d '{"path": "ryemyster/ShaleYeah/<file>", "task": "<spec>"}'
# Then read ~/Library/Application\ Support/context-store/artifacts/draft-*.md

# Multi-file mechanical work
curl -s -X POST http://localhost:8088/scaffold \
  -H "Content-Type: application/json" \
  -d '{"files": [{"path": "ryemyster/ShaleYeah/<file>", "task": "<spec>"}]}'
# Then read each ~/Library/Application\ Support/context-store/artifacts/scaffold-*.md

# Index code at session start (when code has changed)
curl -s -X POST http://localhost:8088/index \
  -H "Content-Type: application/json" \
  -d '{"paths": ["ryemyster/ShaleYeah/sdk/src","ryemyster/ShaleYeah/servers","ryemyster/ShaleYeah/agents"]}'
```
