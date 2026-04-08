# Connecting SHALE YEAH to Claude Desktop, VS Code, and Claude CLI

SHALE YEAH's 14 expert agents are **MCP servers** (Model Context Protocol). That means you can plug any one of them — or all of them — directly into Claude Desktop, VS Code, or the Claude CLI. Once connected, you can talk to them in plain English inside your AI client instead of running command-line tools.

This page covers both macOS and Windows for every step.

---

## Before you start — build the project

All three clients launch the agents as compiled JavaScript files (`dist/servers/*.js`), not the raw TypeScript source. You need to build once before configuring any client, and rebuild any time you pull new code.

The build script is `npm run build`. It runs `tsc` (the TypeScript compiler) and writes output to `dist/`:

```bash
npm install --legacy-peer-deps
npm run build
```

Verify it worked — you should see files like `dist/servers/geowiz.js`:

macOS / Linux:

```bash
ls dist/servers/
```

Windows (PowerShell):

```powershell
Get-ChildItem dist\servers\
```

You will also need the **full absolute path** to the repo for the config files below. Find it with:

macOS / Linux:

```bash
pwd
# Example output: /Users/ryan/Repos/ShaleYeah
```

Windows (Command Prompt):

```cmd
cd
# Example output: C:\Users\ryan\Repos\ShaleYeah
```

Windows (PowerShell):

```powershell
Get-Location
# Example output: C:\Users\ryan\Repos\ShaleYeah
```

Keep that path handy. In JSON config files on Windows, use forward slashes — they work fine: `C:/Users/ryan/Repos/ShaleYeah`.

---

## Claude Desktop

Claude Desktop reads a JSON config file that lists which MCP servers to start. When you open Claude Desktop, it launches those servers in the background and makes their tools available in the chat.

### Step 1 — Find your config file

macOS — open this file in any text editor:

```bash
open -a TextEdit ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

The path is: `~/Library/Application Support/Claude/claude_desktop_config.json`

Windows — open in Notepad:

```cmd
notepad %APPDATA%\Claude\claude_desktop_config.json
```

The path is: `%APPDATA%\Claude\claude_desktop_config.json`

If the file doesn't exist yet, create it. Make sure the folder exists first.

### Step 2 — Add SHALE YEAH servers

Paste the config below, replacing the path with your repo path from the previous step. Start with just `geowiz` and `econobot` — they're the only two with real LLM integration wired today. Add others as they ship.

macOS example:

```json
{
  "mcpServers": {
    "shale-geowiz": {
      "command": "node",
      "args": ["/Users/ryan/Repos/ShaleYeah/dist/servers/geowiz.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    },
    "shale-econobot": {
      "command": "node",
      "args": ["/Users/ryan/Repos/ShaleYeah/dist/servers/econobot.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

Windows example (forward slashes work fine in JSON on Windows):

```json
{
  "mcpServers": {
    "shale-geowiz": {
      "command": "node",
      "args": ["C:/Users/ryan/Repos/ShaleYeah/dist/servers/geowiz.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    },
    "shale-econobot": {
      "command": "node",
      "args": ["C:/Users/ryan/Repos/ShaleYeah/dist/servers/econobot.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

To add more agents, copy any entry and change `geowiz` to the server name you want. All 14 server names: `geowiz`, `econobot`, `curve-smith`, `decision`, `risk-analysis`, `reporter`, `research`, `legal`, `market`, `title`, `development`, `drilling`, `infrastructure`, `test`.

If you already have other MCP servers in your config, add the `shale-*` entries inside the existing `"mcpServers"` object — don't replace the whole file.

### Step 3 — Restart Claude Desktop

macOS: press Command+Q to fully quit (not just close the window), then reopen.

Windows: right-click the Claude icon in the system tray → Quit, then reopen.

Claude Desktop reads the config only at startup — a full restart is required.

### Step 4 — Verify the tools loaded

Click the tools icon (hammer/wrench) in the chat input. You should see `shale-geowiz`, `shale-econobot`, etc. listed. If they don't appear, see [Troubleshooting](#troubleshooting).

### Step 5 — Try it

Type something like:

> "Use shale-geowiz to analyze a Wolfcamp B formation at 9,500 ft depth with 8% porosity and 78% data quality confidence."

Claude will call the geowiz tool and summarize the result in plain English.

---

## VS Code (Claude Code extension)

The Claude Code extension for VS Code supports MCP servers through your user settings (available in all projects) or a workspace config file (available only when that project is open).

### Step 1 — Install the Claude Code extension

Open VS Code, go to Extensions (Cmd+Shift+X on macOS, Ctrl+Shift+X on Windows), and search for **Claude Code**. Install the official Anthropic extension.

### Step 2 — Open your user settings JSON

macOS: Cmd+Shift+P → type "Open User Settings JSON" → Enter

Windows: Ctrl+Shift+P → type "Open User Settings JSON" → Enter

Add the `claude.mcpServers` block to the JSON. Merge it with whatever is already there — don't replace the whole file.

macOS:

```json
{
  "claude.mcpServers": {
    "shale-geowiz": {
      "command": "node",
      "args": ["/Users/ryan/Repos/ShaleYeah/dist/servers/geowiz.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    },
    "shale-econobot": {
      "command": "node",
      "args": ["/Users/ryan/Repos/ShaleYeah/dist/servers/econobot.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

Windows:

```json
{
  "claude.mcpServers": {
    "shale-geowiz": {
      "command": "node",
      "args": ["C:/Users/ryan/Repos/ShaleYeah/dist/servers/geowiz.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    },
    "shale-econobot": {
      "command": "node",
      "args": ["C:/Users/ryan/Repos/ShaleYeah/dist/servers/econobot.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

### Step 3 — Workspace config (optional, recommended)

If you want servers available only when the ShaleYeah folder is open, and you want paths to work without hardcoding, create `.vscode/mcp.json` in the repo root:

```json
{
  "servers": {
    "shale-geowiz": {
      "command": "node",
      "args": ["${workspaceFolder}/dist/servers/geowiz.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    },
    "shale-econobot": {
      "command": "node",
      "args": ["${workspaceFolder}/dist/servers/econobot.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

`${workspaceFolder}` works on both macOS and Windows — VS Code substitutes the correct absolute path automatically. No manual path editing needed.

### Step 4 — Reload VS Code

macOS: Cmd+Shift+P → "Developer: Reload Window"

Windows: Ctrl+Shift+P → "Developer: Reload Window"

---

## Claude CLI (Claude Code)

The Claude CLI reads MCP server config from a settings file in your home directory.

### Step 1 — Find or create the settings file

macOS / Linux:

```bash
cat ~/.claude/settings.json
mkdir -p ~/.claude && touch ~/.claude/settings.json
```

Windows (PowerShell):

```powershell
Get-Content "$env:USERPROFILE\.claude\settings.json"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude"
New-Item -ItemType File -Force "$env:USERPROFILE\.claude\settings.json"
```

### Step 2 — Add SHALE YEAH servers

Open the settings file in any text editor and add a `mcpServers` block. If the file already has content, merge this in — don't replace the whole file.

macOS:

```json
{
  "mcpServers": {
    "shale-geowiz": {
      "command": "node",
      "args": ["/Users/ryan/Repos/ShaleYeah/dist/servers/geowiz.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    },
    "shale-econobot": {
      "command": "node",
      "args": ["/Users/ryan/Repos/ShaleYeah/dist/servers/econobot.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

Windows:

```json
{
  "mcpServers": {
    "shale-geowiz": {
      "command": "node",
      "args": ["C:/Users/ryan/Repos/ShaleYeah/dist/servers/geowiz.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    },
    "shale-econobot": {
      "command": "node",
      "args": ["C:/Users/ryan/Repos/ShaleYeah/dist/servers/econobot.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

### Step 3 — Verify in the CLI

Start a Claude CLI session and run `/mcp`. You should see your `shale-*` servers listed as connected. If they show as failed, see [Troubleshooting](#troubleshooting).

### Step 4 — Use the tools

In any Claude CLI session you can now ask:

> "Run a geological analysis using shale-geowiz on a Permian Basin Wolfcamp A formation at 8,200 ft."

---

## Running individual servers manually (for testing)

Before adding a server to any client config, verify it starts correctly by running it directly. This is the fastest way to spot path or build errors.

macOS / Linux:

```bash
npm run server:geowiz
```

Windows:

```cmd
npm run server:geowiz
```

Or run the compiled file directly (both platforms):

```bash
node dist/servers/geowiz.js
```

The server starts and waits silently for MCP messages on stdin. No output until a client connects — that's normal. Press Ctrl+C to stop it.

If it exits immediately with an error:

- `Cannot find module` — run `npm run build` first
- `ANTHROPIC_API_KEY is not set` — the server still starts and falls back to rule-based estimates; this is not an error
- `Error: ENOENT` — path problem; make sure you ran `npm run build` from the repo root

---

## Keeping your API key out of config files

Storing your API key directly in config files means it's in plain text. A safer approach uses a `.env` file — already in `.gitignore` so it won't be committed.

macOS / Linux:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env
echo "EIA_API_KEY=your-eia-key-here" >> .env
```

Windows (PowerShell):

```powershell
"ANTHROPIC_API_KEY=sk-ant-your-key-here" | Out-File -FilePath .env -Encoding utf8
"EIA_API_KEY=your-eia-key-here" | Add-Content -Path .env
```

Then replace the `"command"` entry in your MCP config with a node inline loader:

macOS:

```json
{
  "command": "node",
  "args": [
    "-e",
    "require('dotenv').config({path:'/Users/ryan/Repos/ShaleYeah/.env'}); require('/Users/ryan/Repos/ShaleYeah/dist/servers/geowiz.js')"
  ]
}
```

Windows:

```json
{
  "command": "node",
  "args": [
    "-e",
    "require('dotenv').config({path:'C:/Users/ryan/Repos/ShaleYeah/.env'}); require('C:/Users/ryan/Repos/ShaleYeah/dist/servers/geowiz.js')"
  ]
}
```

---

## Troubleshooting

### Server doesn't appear in the tools list

- Confirm the build succeeded: check that `dist/servers/geowiz.js` exists
- Verify the path in your config is correct (macOS: `ls dist/servers/`, Windows: `dir dist\servers\`)
- Do a full restart of the client — not just a reload
- macOS: check Console.app (search "node") for crash logs
- Windows: check Event Viewer → Windows Logs → Application for node errors

### Server appears but tools return errors

- Run the server directly (`node dist/servers/geowiz.js`) and check the output
- Verify your API key is valid at [console.anthropic.com](https://console.anthropic.com)
- Without a valid API key, servers still run and return rule-based estimates — that's expected, not an error

### `Cannot find module '@modelcontextprotocol/sdk'`

- Run `npm install --legacy-peer-deps` from the repo root, then `npm run build`

### Windows: `node` is not recognized

- Install Node.js 18+ from [nodejs.org](https://nodejs.org/) and restart your terminal
- Verify with: `node --version`

### Windows: paths with backslashes cause JSON errors

- Use forward slashes in JSON: `C:/Users/ryan/Repos/ShaleYeah` — they work on Windows

### Tools are listed but Claude doesn't use them

- Be explicit: "use shale-geowiz to..." rather than just asking a question
- Some clients require you to enable tool use in their settings

### Changes to server code aren't showing up

- Rebuild after any code change: `npm run build`
- Then fully restart the MCP client to reload the server process

---

Generated with SHALE YEAH 2025 Ryan McDonald - Apache-2.0
