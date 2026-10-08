# Getting Started

This page explains how to work with the current repository layout. The project is moving toward an ADK-first architecture, so these commands describe the present workspace rather than a permanent runtime requirement.

## Prerequisites

- Node.js 22 or newer (the shared contract test/coverage commands require it)
- pnpm 9 or newer
- uv and Python 3.11–3.14 for the shared contract parity checks; CI uses Python 3.12
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

For Python employees, follow their package-local README. To check the shared
business records in both languages:

```bash
cd contracts
pnpm build
pnpm lint
pnpm test
pnpm check:isolation
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
