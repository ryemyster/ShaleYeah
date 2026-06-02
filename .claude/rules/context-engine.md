# Rule: Context Engine — Mandatory Scout Usage

**Service:** `http://localhost:8088` (context-engine — read-only local context scout and delegation layer)

**Path convention:** all `path` params must be prefixed with `ryemyster/ShaleYeah/` — e.g. `"ryemyster/ShaleYeah/src/kernel"`. Never use bare `"src/..."` — the engine root is `~/Repos`, not this repo.

**Output location:** `~/Library/Application Support/context-store/artifacts/` — never written to the repo. Artifacts are summaries — always verify real source files before editing.

## Decision rules

| Situation | Action |
|---|---|
| Starting any non-trivial task | `POST /context` — always start here; read `context-bundle.md` from artifacts before planning |
| Need to know what is in a directory | `POST /scan` |
| Need to find where a concept lives | `POST /find` |
| Need all routes in a file tree | `POST /routes` |
| Need to understand one specific file | `POST /summarize` |
| Need the import graph of a path | `POST /dependencies` |
| After any set of code edits | `POST /diff-summary` with `git diff HEAD` — read risks and test recommendations |
| Want semantically similar code chunks | `POST /vector-search` (only after `/index` has been run) |
| Mechanical work — single file, spec is clear | `POST /draft` — read `draft-*.md`, verify, then apply |
| Mechanical work — multi-file, spec is clear | `POST /scaffold` — read each `scaffold-*.md`, review all before applying any |
| Scout is unreachable | Proceed without it — never block on the scout |

**Do not delegate to /draft or /scaffold:** novel architecture, auth/security paths, complex multi-system logic — anything requiring judgment.

## Example calls

```bash
# Load context before a task
curl -s -X POST http://localhost:8088/context \
  -H "Content-Type: application/json" \
  -d '{"task": "<describe what you are about to do>", "paths": ["ryemyster/ShaleYeah/src/kernel","ryemyster/ShaleYeah/src/servers","ryemyster/ShaleYeah/src/shared"], "focus": ["<relevant terms>"]}'
# Then read ~/Library/Application\ Support/context-store/artifacts/context-bundle.md

# Diff summary after edits
curl -s -X POST http://localhost:8088/diff-summary \
  -H "Content-Type: application/json" \
  -d "{\"diff\": \"$(git diff HEAD)\"}"
# Then read ~/Library/Application\ Support/context-store/artifacts/diff-<hash>.md
```
