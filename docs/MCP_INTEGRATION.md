# Connecting SHALE YEAH to Claude Desktop, VS Code, and Claude CLI

SHALE YEAH's 14 MCP tool servers can plug directly into Claude Desktop, VS Code, or any MCP-compatible client. Once connected, you can talk to them in plain English.

---

## Before you start — build the packages

```bash
pnpm install
pnpm turbo build
```

Each server compiles to its own `dist/index.js` inside `servers/<name>/`.

---

## Claude Desktop

Claude Desktop reads a JSON config that lists which MCP servers to start at launch.

### Step 1 — Find your config file

macOS:
```bash
open -a TextEdit ~/Library/Application\ Support/Claude/claude_desktop_config.json
```
Path: `~/Library/Application Support/Claude/claude_desktop_config.json`

Windows:
```cmd
notepad %APPDATA%\Claude\claude_desktop_config.json
```

Create the file if it doesn't exist.

### Step 2 — Add SHALE YEAH servers

Replace `/path/to/ShaleYeah` with your actual repo path.

```json
{
  "mcpServers": {
    "shale-geowiz": {
      "command": "pnpm",
      "args": ["--filter", "@shaleyeah/server-geowiz", "start"],
      "cwd": "/path/to/ShaleYeah",
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    },
    "shale-econobot": {
      "command": "pnpm",
      "args": ["--filter", "@shaleyeah/server-econobot", "start"],
      "cwd": "/path/to/ShaleYeah",
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

To add more servers, copy any entry and change the filter and key. All 14 filter names:

| Filter | Server |
|--------|--------|
| `@shaleyeah/server-geowiz` | Geological analysis |
| `@shaleyeah/server-econobot` | Economic analysis |
| `@shaleyeah/server-curve-smith` | Decline curves |
| `@shaleyeah/server-decision` | Investment decision |
| `@shaleyeah/server-reporter` | Report generation |
| `@shaleyeah/server-research` | Web research |
| `@shaleyeah/server-risk-analysis` | Monte Carlo risk |
| `@shaleyeah/server-legal` | Legal/regulatory |
| `@shaleyeah/server-market` | Commodity prices |
| `@shaleyeah/server-title` | Title analysis |
| `@shaleyeah/server-development` | Development planning |
| `@shaleyeah/server-drilling` | Drilling engineering |
| `@shaleyeah/server-infrastructure` | Midstream infrastructure |
| `@shaleyeah/server-qa` | Quality assurance |

### Step 3 — Restart Claude Desktop

macOS: Command+Q to fully quit, then reopen.  
Windows: right-click tray icon → Quit, then reopen.

Claude Desktop reads the config only at startup.

### Step 4 — Verify

Click the tools icon (hammer) in chat. You should see `shale-geowiz`, `shale-econobot`, etc.

### Step 5 — Try it

> "Use shale-geowiz to analyze a Wolfcamp B formation at 9,500 ft depth with 8% porosity and 78% data quality confidence."

---

## VS Code (Claude Code extension)

### Step 1 — Install the Claude Code extension

Extensions panel → search **Claude Code** → install.

### Step 2 — Open User Settings JSON

macOS: Cmd+Shift+P → "Open User Settings JSON"  
Windows: Ctrl+Shift+P → "Open User Settings JSON"

Add to the JSON (merge, don't replace):

```json
{
  "claude.mcpServers": {
    "shale-geowiz": {
      "command": "pnpm",
      "args": ["--filter", "@shaleyeah/server-geowiz", "start"],
      "cwd": "/path/to/ShaleYeah",
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

### Step 3 — Reload VS Code

Cmd+Shift+P → "Developer: Reload Window"

---

## Claude CLI (claude-code)

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "shale-geowiz": {
      "command": "pnpm",
      "args": ["--filter", "@shaleyeah/server-geowiz", "start"],
      "cwd": "/path/to/ShaleYeah",
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

---

## Troubleshooting

**Tools don't appear after restart:**
- Verify the build ran: `ls servers/geowiz/dist/index.js`
- Check the absolute path in `cwd` is correct
- Look at the Claude Desktop logs (macOS: `~/Library/Logs/Claude/`)

**"Module not found" errors:**
- Re-run `pnpm turbo build` from the repo root
- Check `pnpm install` ran first

**Server starts but tools return errors:**
- Confirm `ANTHROPIC_API_KEY` is set — servers fall back to rule-based estimates without it, but still run
- For market server: optionally set `EIA_API_KEY` for real commodity prices (see `servers/market/docs/EIA_API_SETUP.md`)
