# update-docs

Update README.md and impacted `docs/` files to reflect code changes made in the current issue.

## Usage

`/update-docs`

Invoked automatically as part of `/finish-issue`. Can also be run standalone after any code change.

## Steps

1. **Identify changed files** since the branch diverged from develop:

   ```bash
   git diff develop...HEAD --name-only
   ```

2. **Map changed files to docs** using this table:

   | Changed area | Docs to review |
   | --- | --- |
   | `src/servers/<name>.ts` | `docs/SERVERS.md` (agent entry), `docs/DEMO_VS_PRODUCTION.md` (LLM status table), `README.md` (agent quick list), `docs/MCP_INTEGRATION.md` (if server name or launch command changed) |
   | `src/kernel/` | `docs/ARCHITECTURE.md`, `docs/API_REFERENCE.md`, `docs/GLOSSARY.md` (kernel section) |
   | `src/shared/llm-client.ts` | `docs/GLOSSARY.md` (callLLM section), `docs/ARCHITECTURE.md` |
   | `src/fixtures/` | `docs/DEMO_VS_PRODUCTION.md` |
   | `tools/` | `docs/ARCHITECTURE.md` |
   | `tests/` | `docs/ARCHITECTURE.md` (test suite table), `docs/GETTING_STARTED.md` (if test commands changed) |
   | `package.json` scripts | `README.md` (Running individual agents, Contributing), `docs/GETTING_STARTED.md` |
   | New oil/gas concept introduced | `docs/GLOSSARY.md` — add an entry explaining the term, why it matters, and which file handles it |

3. **Read each impacted doc** and check for stale content:
   - LLM Integration Status table — update when a server gets `callLLM` wired (mark ✅, remove "Planned")
   - Test suite table in ARCHITECTURE.md — update counts when new test files are added
   - Command examples that reference removed or renamed scripts
   - Any line that says a feature is "planned" or "coming soon" when it has now shipped
   - Output directory paths — verify they match actual runtime behavior

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
   - LLM Integration Status table reflects which servers have `callLLM` wired
   - Quick Start git clone URL is `github.com/ryemyster/ShaleYeah`
   - Prerequisites correctly says `ANTHROPIC_API_KEY` is required for real AI output
   - Individual Expert Servers list matches the 14 servers in `src/servers/`
   - Contributing steps match the current branch/PR workflow

7. **Stage doc changes** — do not commit yet; let `/finish-issue` handle the commit.

## Rules

- Never add new doc sections unless the code introduces a genuinely new concept.
- Do not update dates or version numbers — those are handled by CHANGELOG.md.
- If a doc file is unaffected by the change, leave it untouched.
- Fix any markdown lint warnings introduced by your edits (blank lines around lists/tables, no emphasis-as-heading).
