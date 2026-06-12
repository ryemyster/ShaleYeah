# update-docs

Update README.md and impacted `docs/` files to reflect code changes made in the current issue.

## Usage

`/update-docs`

Invoked automatically as part of `/finish-issue`. Can also be run standalone after any code change.

## Steps

1. **Scan impacted doc directories via context-engine:**

   For each package touched by the current branch diff, use the `scan_directory` MCP tool with `path` set to `ryemyster/ShaleYeah/<package>/docs`. Results returned inline — use them to identify stale sections, orphaned files, and outdated status markers before opening any doc file manually. Skip if unreachable.

2. **Identify changed files** since the branch diverged from develop:

   ```bash
   git diff develop...HEAD --name-only
   ```

2. **Map changed files to docs** using this table:

   | Changed area | Docs to review |
   | --- | --- |
   | `servers/<name>/src/` | `servers/<name>/README.md`, `servers/<name>/docs/ARCHITECTURE.md`, root `README.md` (server list), root `ARCHITECTURE.md` |
   | `agents/<name>/src/` | `agents/<name>/README.md`, `agents/<name>/docs/ARCHITECTURE.md`, `agents/<name>/docs/DEPLOYMENT.md`, root `README.md` |
   | `sdk/src/llm-client.ts` | Root `ARCHITECTURE.md` (callLLM section), root `README.md` |
   | `sdk/src/mcp-server.ts` or `sdk/src/runtime.ts` | Root `ARCHITECTURE.md`, `CONTRIBUTING.md` |
   | `sdk/src/contracts.ts` | Root `ARCHITECTURE.md`, root `README.md` (any manifest/config docs) |
   | `*/package.json` or `pnpm-workspace.yaml` | Root `README.md` (setup steps), `CONTRIBUTING.md` |
   | New oil/gas concept introduced | Root `README.md` or relevant package README — add an entry explaining the term, why it matters, and which file handles it |

3. **Read each impacted doc** and check for stale content:
   - Server/agent table rows — update when a server gets `callLLM` wired (mark ✅, remove "Planned")
   - Test command examples that reference removed or renamed scripts
   - Any line that says a feature is "planned" or "coming soon" when it has now shipped
   - Package paths — verify they reference `servers/<name>/` or `agents/<name>/` not the old `src/servers/` layout
   - Per-package `docs/DEPLOYMENT.md` — verify launch commands match current `package.json` scripts

4. **Update only what changed.** Do not rewrite docs wholesale. Edit the specific stale sentence or table row. Preserve the existing voice and formatting around your change.

5. **Writing standard — every doc update must pass this check:**

   Imagine handing the doc to a 12-year-old who has never heard of oil & gas or MCP servers. They should be able to:
   - Understand what each section is for without reading other files
   - Follow any numbered steps without getting stuck on unexplained jargon
   - Know what to do when something doesn't work

   To meet this standard:
   - Define every acronym or technical term the first time it appears (e.g., "MCP (Model Context Protocol) is a standard way for AI tools to talk to each other")
   - Replace vague phrases like "production-ready" or "architecture complete" with concrete facts ("geowiz and econobot call the Claude API; the other 12 servers use rule-based estimates")
   - Turn implied steps into explicit numbered steps
   - When a command is shown, always say what it does and where the output goes

6. **README.md checklist** — always verify these sections are current:
   - Server/agent table reflects current implementation status
   - Quick Start git clone URL is `github.com/ryemyster/ShaleYeah`
   - Prerequisites correctly says `ANTHROPIC_API_KEY` is required for real AI output
   - Server list matches the 14 packages in `servers/`
   - Setup steps use `pnpm install` and `pnpm turbo build`, not `npm install`
   - Contributing steps match the current branch/PR workflow

7. **Stage doc changes** — do not commit yet; let `/finish-issue` handle the commit.

## Rules

- Never add new doc sections unless the code introduces a genuinely new concept.
- Do not update dates or version numbers — those are handled by CHANGELOG.md.
- If a doc file is unaffected by the change, leave it untouched.
- Fix any markdown lint warnings introduced by your edits (blank lines around lists/tables, no emphasis-as-heading).
