# SHALE YEAH

## Open-source agent OS for oil and gas investment diligence

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
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
- [configurable employee evaluations](evaluations/README.md) with trusted metrics, portable run reports and [reference qualification gates](evaluations/docs/qualification.md) for CI, release packaging and protected saves
- [Geologist LAS input review](servers/geowiz/docs/LAS_REVIEW.md) with measured observations, explicit calculation assumptions, public parser samples and visible calibration gaps
- [Geologist working context](agents/geologist/docs/WORKING_CONTEXT.md) with native SQLite restart, current-source checks, bounded model input and scoped recovery
- [Geologist human review](servers/geowiz/docs/HUMAN_REVIEW.md) with exact evidence/action inspection, request changes/reject/approve and transactional private save/resume
- [Independent reference packages and containers](docs/reference-packages.md) with clean builds, scoped context/review recovery and required fixture qualification

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
[Econobot](servers/econobot/README.md) calculates explicit periodic cash flows,
with declared currency, timing, source revisions and unavailable metrics. Its
numerical results remain advisory. The [Economist employee](agents/economist/README.md)
adds its own durable context, configurable actual-output scorecard and exact
human scenario review before private storage. It cannot commit capital.
The [Reporter employee](agents/reporter-agent/README.md) prepares source-linked
private reports with an exact human publication gate and configurable scorecard.
The [QA server](servers/qa-server/README.md) runs configurable observed data
checks and reports their recorded results, with optional unreviewed model notes.
The [QA employee](agents/quality-assurance/README.md) preserves those observations,
uses its own scoped context and configurable scorecard, and prepares exact private
dispositions for an authenticated human owner. An exception retains the original failure.

## Start Here

| Topic | Link |
| --- | --- |
| Choose a package, set it up and deliver one issue | [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) |
| Architecture details | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Durable employee contracts and technology boundaries | [ADR 0001](docs/adr/0001-durable-employee-contracts.md) |
| Permitted role data sources, exact-byte provenance and installed adapter hooks | [connectors/README.md](connectors/README.md) |
| Employee record schemas, Python/TypeScript validation and compatibility | [contracts/README.md](contracts/README.md) |
| Follow task, tool, model, evaluation and human-review events | [Employee events](docs/employee-events.md) |
| Employee workflows, data, context, evaluations and human review | [Employee role matrix](docs/employee-role-matrix.md) |
| Current topology and boundaries | [docs/topology.md](docs/topology.md) |
| Local reference setup and qualified deployment limits | [Deployment support](docs/deployment-support.md) |
| MVP delivery order and acceptance gates | [docs/mvp-release-plan.md](docs/mvp-release-plan.md) |
| Contributing and branch workflow | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Security policy | [SECURITY.md](SECURITY.md) |
| Package-local usage | `agents/*/README.md`, `servers/*/README.md`, `orchestrator/README.md` |

## Project Status

Geologist, Reporter, QA and Economist have implemented reference employee workflows with
configured evaluations, persistent context, protected review and independent
package checks. Nine other roles have basic ADK definitions and Reservoir Engineer
retains its TypeScript employee loop; their full workflows are still pending.
The optional coordinator is a stub. Fixture qualification is separate from
professional validation and real operator acceptance.

Curve-smith's [versioned type-curve tools](servers/curve-smith/README.md) use
supplied rate histories or explicit scenarios and report finite modeled volumes.
Wider decline-fitting qualification and Reservoir Engineer adoption remain pending.

The project is in an active architecture refactor. Existing TypeScript workspace tooling remains in place while the ADK-first, independently deployable agent/MCP model is rebuilt in small spec-driven blocks.

Current root commands are workspace conveniences, not permanent architecture constraints. Package-local READMEs and docs are the source of truth for each independently buildable unit.

TypeScript workspace checks do not run every Python employee's tests or live
evaluations. Contributor setup uses the owning package's commands and the
[shared sequential delivery flow](docs/sdlc.md) for Codex, Antigravity and Claude
Code. [Deployment support](docs/deployment-support.md) records which local checks
ran and what still needs qualification.

## License

Apache License 2.0 - 2025 Ryan McDonald. See [LICENSE](LICENSE).
