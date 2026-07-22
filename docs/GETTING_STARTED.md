# Getting Started

This page explains how to work with the current repository layout. The project is moving toward an ADK-first architecture, so these commands describe the present workspace rather than a permanent runtime requirement.

## Prerequisites

- Node.js 18 or newer
- pnpm 9 or newer
- Git
- Optional model provider keys for real LLM-backed runs

## Install

```bash
git clone https://github.com/ryemyster/ShaleYeah.git
cd ShaleYeah
pnpm install
```

## Verify The Workspace

```bash
pnpm turbo build
pnpm turbo type-check
pnpm turbo lint
pnpm turbo test
```

For scoped work, prefer package-local commands from the owning package:

```bash
cd servers/geowiz
pnpm build
pnpm test
```

```bash
cd agents/geologist
pnpm build
pnpm test
```

## Run An MCP Server

Each server owns its own README. Start there for package-specific setup.

Example Claude Desktop-style MCP entry for `geowiz`:

```json
{
  "mcpServers": {
    "geowiz": {
      "command": "pnpm",
      "args": ["--filter", "@shaleyeah/server-geowiz", "start"],
      "cwd": "/path/to/ShaleYeah",
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

## Work On An Issue

Branch from `develop`:

```bash
git switch develop
git pull
git switch -c issue-<number>-<slug>
```

Every issue should have:

- clear understanding
- definition of done
- operating mode
- security review
- test coverage expectation
- docs impact
- deletion plan for displaced code

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full workflow.
