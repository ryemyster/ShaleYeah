# SHALE YEAH

## Open-source agent OS for oil and gas investment diligence

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io/)

SHALE YEAH is an open-source, BYOE (Bring Your Own Everything) agent system for oil and gas investment due diligence. The goal is to make high-quality deal review affordable and fast enough for independent operators, small funds, mineral buyers, and technical teams that cannot staff a full enterprise diligence department.

There are [roughly 9,000 independent oil and gas operators](https://www.ipaa.org/independent-producers/) in the US. They run most American wells, but a serious deal review still often means weeks of work across geology, reservoir engineering, economics, title, legal, market, risk, development, drilling, infrastructure, reporting, and final investment review. That pushes meaningful analysis behind enterprise budgets.

SHALE YEAH exists to close that gap: not by replacing human judgment, but by making the data work, technical review, and cross-functional synthesis cheap enough that people spend more time on decisions.

## What This Repo Is Becoming

This repo is a monorepo workspace for independently buildable project units:

- specialist ADK agents
- MCP-compatible tool servers
- an optional orchestrator
- shared contracts, schemas, and runtime helpers

Each agent, MCP server, and orchestrator is intended to stand alone. The monorepo is the contributor workspace; it is not meant to force a single deployment shape. A user should be able to run one MCP server, one agent, an agent with a third-party MCP, a third-party agent with one of these MCPs, or the full reference system.

## High-Level Architecture

The project is moving toward an ADK-first architecture:

- ADK owns agent reasoning, local development, tool orchestration, and eval workflows.
- MCP servers own deterministic domain tools, parsers, data integrations, and tool contracts.
- The orchestrator is optional and coordinates multi-agent business workflows when useful.
- Runtime deployment stays portable: local, container, VM, Fly.io, Cloud Run, GKE, Agent Runtime, or similar.
- Security, HITL, evals, memory, auditability, and observability are first-class concerns.

Most specialist roles start as stand-alone agents with progressive disclosure. More complex workflows may use hierarchical agents, graph-based orchestration, ambient/event-driven execution, or capability-first routing when the use case justifies it.

## Specialist Areas

The reference fleet covers 14 business concerns:

| Area | Persona | Reference MCP / service |
| --- | --- | --- |
| Geology | Marcus Aurelius Geologicus | `servers/geowiz` |
| Economics | Caesar Augustus Economicus | `servers/econobot` |
| Reservoir engineering | Lucius Technicus Engineer | `servers/curve-smith` |
| Risk | Gaius Probabilis Assessor | `servers/risk-analysis` |
| Legal | Legatus Juridicus | `servers/legal` |
| Market | Mercatus Analyticus | `servers/market` |
| Title | Titulus Verificatus | `servers/title` |
| Development planning | Architectus Developmentus | `servers/development` |
| Drilling | Perforator Maximus | `servers/drilling` |
| Research | Scientius Researchicus | `servers/research` |
| Reporting | Scriptor Reporticus Maximus | `servers/reporter` |
| Quality assurance | Testius Validatus | `servers/qa-server` |
| Infrastructure | Structura Ingenious | `servers/infrastructure` |
| Investment decision | Augustus Decidius Maximus | `servers/decision` |

Each corresponding agent lives under `agents/<role>/` when implemented or migrated.

## Start Here

| Topic | Link |
| --- | --- |
| Build and run the current workspace | [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) |
| Architecture details | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Current topology and boundaries | [docs/topology.md](docs/topology.md) |
| Contributing and branch workflow | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Security policy | [SECURITY.md](SECURITY.md) |
| Package-local usage | `agents/*/README.md`, `servers/*/README.md`, `orchestrator/README.md` |

## Project Status

The project is in an active architecture refactor. Existing TypeScript workspace tooling remains in place while the ADK-first, independently deployable agent/MCP model is rebuilt in small spec-driven blocks.

Current root commands are workspace conveniences, not permanent architecture constraints. Package-local READMEs and docs are the source of truth for each independently buildable unit.

## License

Apache License 2.0 - 2025 Ryan McDonald. See [LICENSE](LICENSE).
